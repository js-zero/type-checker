/*
 * Implementation of "Compositional Type Checking" by Georgö Érdi
 * Download the whitepaper PDF at http://gergo.erdi.hu/projects/tandoori/
 */
'use strict'

var ESTraverse   = require('estraverse')
var Scope        = require('./scope')
var Errors       = require('./type-errors')

var Env     = require('./environment')
var Typing  = require('./typing')
var t       = require('../types')

var unifyMonoEnvs     = require('./unify').unifyMonoEnvs
var compileAnnotation = require('../type-annotations').compile

var util = require('util')
var fail = require('./assert').fail

var _ = require('lodash')


exports.typeCheck = function (runtimeEnv, ast) {

  var env = Env(runtimeEnv)

  try {
    buildEnv(env, ast)
    log("\n----\nGOT environment:", inspect(env))
    return { env: env, typeErrors: [] }
  }
  catch (err) {
    if (err instanceof Errors.TypeError) {
      // Eventually we want to be able to return multiple type errors in one go
      return { env: env, typeErrors: [err] }
    }
    else {
      throw err
    }
  }
}


function buildEnv (env, node) {

  switch(node.type) {

    //
    // Transient nodes
    //
    case 'Program':
    case 'BlockStatement':
      // Every statement can potentially add to the environment (e.g. `let` statements).
      for (var i=0; i < node.body.length; i++) {
        var child = node.body[i]
        buildEnv(env, child)
        if ( child.type === 'ReturnStatement' ) break;
      }
      return env

    break; case 'VariableDeclaration':

      if (node.kind !== 'let') {
        fail("Only `let` declarations are allowed.")
      }
      if (node.declarations.length > 1) {
        fail("Only one assignment per `let` is allowed.")
      }

      var decl = node.declarations[0]
      if (decl.id.type !== 'Identifier') {
        fail("Destructuring not yet supported")
      }

      if (decl.init.type === 'ArrowFunctionExpression') {
        decl.init._name = decl.id.name
      }

      if ( env.shouldInfer(decl.id.name) ) {
        var typing = inferExpr(env, decl.init)
        env.assign( decl.id.name, typing )
      }

      return env


    break; case 'ExpressionStatement':
      if (
           node.expression.type === 'TaggedTemplateExpression'
        && node.expression.tag.type === 'Identifier'
        && node.expression.tag.name === '$assume'
      ) {

        var annotationSrc = node.expression.quasi.quasis[0].value.raw

        if ( ! annotationSrc.match(/^ *[a-z][a-z0-9]* *:/i) ) {
          throw new Error(`A type annotation must have a name and a type, separated by a colon, e.g. myFunc : Num`)
        }

        var colonIndex = annotationSrc.indexOf(':')
        var varName = _.trim( annotationSrc.substring(0, colonIndex) )
        var annotation = compileAnnotation( annotationSrc.substring(colonIndex+1) )

        return env.assume( varName, Typing({}, annotation.type) )
      }
      else {
        return inferExpr(env, node.expression)
      }

    break; case 'ReturnStatement':
      var typing = node.argument
        ? inferExpr( env, node.argument )
        : Typing( null, t.TermUndefined(node) )

      return env.assign('*return', typing)

    default:
      throw new Error("Statement not supported: " + node.type)
  }
}



function inferFunctionBody (env, paramNames, node) {

  if ( node.type !== 'BlockStatement' ) {
    fail(`Not a block statement (this sholudn't happen)`)
  }

  for (var i=0; i < node.body.length; i++) {
    var child = node.body[i]
    buildEnv(env, child)
    if ( child.type === 'ReturnStatement' ) break;
  }


  var returnTyping = env.typings['*return'] || Typing( {}, t.TermUndefined(node) )
  delete env.typings['*return']

  //
  // Merge any generated monoEnv restrictions on parameters with return type.
  // This is important to bubble up type restrictions on function params.
  //
  // WARNING: This approach may be incorrect.
  //          If you are a type theory export, please verify!
  //
  var monoEnvs = _.map( env.typings ).map( ty => ty.monoEnv ).concat( [returnTyping.monoEnv] )
  var substitutions = unifyMonoEnvs( _.identity, env, monoEnvs )

  var finalMonoEnv = Typing.substituteAndAggregateMonoEnvs( substitutions, monoEnvs )
  var finalType = t.applySubs(substitutions, returnTyping.type)

  return Typing( finalMonoEnv, finalType )
}



function inferExpr (env, node) {

  switch(node.type) {

    //
    // Constraint-generating nodes
    //
    case 'Literal':
      log("> Literal", node.value)
      return Typing(null, litTermFromNode(node))


    break; case 'TemplateLiteral':
      //
      // A TemplateLiteral will always be a string,
      // so the only thing to do is to ensure
      // the interpolated expressions are well-typed.
      //
      var exprTypings  = node.expressions.map( q => inferExpr(env, q) )
      var exprMonoEnvs = exprTypings.map( ty => ty.monoEnv )

      var substitutions = unifyMonoEnvs(
        _.identity,
        env,
        exprMonoEnvs
      )

      //
      // Combine monoEnv constraints to bubble them up the AST.
      //
      var monoEnv = Typing.substituteAndAggregateMonoEnvs(
        substitutions,
        exprMonoEnvs
      )


      return Typing(monoEnv, t.TermString(node))

    break; case 'Identifier':
      log("> Identifier", node.name)

      // [PolyVar], p.33
      return env.lookupOrFail(node.name).instantiate()


    break; case 'ArrayExpression':
      log(`> ArrayExpression (${node.elements.length})`)

      //
      // Ensure all array elements agree on a single type
      //
      var elemType     = t.TypeVar(null)
      var elemTypings  = node.elements.map( e => inferExpr(env, e) )
      var elemMonoEnvs = elemTypings.map( et => et.monoEnv )

      var substitutions = unifyMonoEnvs(
        (err) =>
          new Errors.ArrayLiteralTypeError(err, env, node, elemTypings),
        env,
        elemMonoEnvs,
        elemTypings.map(
          et => t.Constraint(elemType, et.type)
        )
      )

      var arrayMonoEnv = Typing.substituteAndAggregateMonoEnvs(
        substitutions,
        elemMonoEnvs
      )

      return Typing(
        arrayMonoEnv,
        t.ConArray(node, t.applySubs(substitutions, elemType))
      )



    break; case 'BinaryExpression':
      log("> BinaryExpression", node.operator)

      var leftTyping = inferExpr(env, node.left)
      var rightTyping = inferExpr(env, node.right)

      if (
        node.operator === '+' || node.operator === '-' ||
        node.operator === '*' || node.operator === '/' ||
        node.operator === '%' || node.operator === '**'
      )
      {
        //
        // Numerical operator
        //
        var substitutions = unifyMonoEnvs(
          _.identity,
          env,
          [ leftTyping.monoEnv, rightTyping.monoEnv ],
          [
            t.Constraint( leftTyping.type, t.TermNum(node.left) ),
            t.Constraint( rightTyping.type, t.TermNum(node.right) )
          ]
        )

        // Δ = 𝚿Δ_1 ∪ 𝚿Δ_2
        var monoEnv = Typing.substituteAndAggregateMonoEnvs(
          substitutions,
          [leftTyping.monoEnv, rightTyping.monoEnv]
        )

        return Typing(monoEnv, t.TermNum(node))

      }
      else if (
        node.operator === '>'   || node.operator === '<'   ||
        node.operator === '>='  || node.operator === '<='  ||
        // TODO: When boolean or string is enforced, move these four to another else branch
        node.operator === '&&'  || node.operator === '||' ||
        node.operator === '===' || node.operator === '!=='
      )
      {
        //
        // Comparison operator
        //
        var substitutions = unifyMonoEnvs(
          _.identity, // TODO: Boolean operator-specific error
          env,
          [ leftTyping.monoEnv, rightTyping.monoEnv ],
          [
            // TODO: Enforce boolean or string
            t.Constraint( leftTyping.type, rightTyping.type ),
          ]
        )

        // Δ = 𝚿Δ_1 ∪ 𝚿Δ_2
        var monoEnv = Typing.substituteAndAggregateMonoEnvs(
          substitutions,
          [leftTyping.monoEnv, rightTyping.monoEnv]
        )

        return Typing(monoEnv, t.TermBool(node))

      }
      else {
        // TODO: Better error message
        throw new Error(`Operator not supported: ${node.operator}`)
      }


    break; case 'ArrowFunctionExpression':
      log("> ArrowFunctionExpression")

      return node._name ? defFunction(env, node, node._name) : absFunction(env, node)


    break; case 'CallExpression':
      //
      // [App], p.34
      //
      log("> CallExpression")

      //
      // Γ; Δ_1 ⊢ E :: 𝞣'
      //
      var calleeTyping = inferExpr(env, node.callee)

      //
      // Γ; Δ_2 ⊢ F :: 𝞣''
      //
      var argumentTypings = node.arguments.map( a => inferExpr(env, a) )


      // α new
      var callExprType = t.TypeVar(node)

      //
      // 𝚿 = 𝓤({ Δ_1, Δ_2 }, { 𝞣' ~ 𝞣'' -> α })
      //
      var monoEnvs = argumentTypings.map( at => at.monoEnv ).concat( [calleeTyping.monoEnv] )

      var substitutions = unifyMonoEnvs(
        (err) =>
          new Errors.CallTypeError(err, env, node, calleeTyping, argumentTypings),
        env,
        monoEnvs,
        [t.Constraint(
          calleeTyping.type,
          t.Arrow(
            node,
            argumentTypings.map( at => at.type ),
            callExprType
          )
        )]
      )

      //
      // Δ = 𝚿Δ_1 ∪ 𝚿Δ_2 ∪ ... ∪ 𝚿Δ_n
      //     where n = node.arguments.length+1
      //
      // The [App] rule in the paper only handles functions with one argument.
      // In our case, we need to handle any number of arguments.
      //
      var callMonoEnv = Typing.substituteAndAggregateMonoEnvs(
        substitutions,
        monoEnvs
      )

      // 𝞣 = 𝚿α
      var finalType = t.applySubs(substitutions, callExprType)

      return Typing( callMonoEnv, finalType )

    break; case 'ObjectExpression':
      log("> ObjectExpression")
      // JS Zero types objects as records
      var seenLabels = {}

      // TODO: Occurs check
      var rowTypings = {}
      var rowTypingMonoEnvs = []

      node.properties.forEach(function(prop) {
        if ( prop.key.type !== 'Identifier' && prop.key.type !== 'Literal' ) {
          // TODO: Better error message
          fail(`Only literals are allowed for object keys`)
        }

        var label = '' + (prop.key.type === 'Identifier') ? prop.key.name : prop.key.value

        if ( seenLabels[label] ) {
          // TODO: Better error message
          fail(`Duplicate object label: ${label}`)
        }
        else seenLabels[label] = true

        var propTyping = inferExpr(env, prop.value)
        rowTypingMonoEnvs.push( propTyping.monoEnv )
        rowTypings[label] = propTyping
      })

      var substitutions = unifyMonoEnvs(
        _.identity,
        env,
        rowTypingMonoEnvs
      )

      //
      // Combine monoEnv constraints to bubble them up the AST.
      //
      var monoEnv = Typing.substituteAndAggregateMonoEnvs(
        substitutions,
        rowTypingMonoEnvs
      )


      return Typing(
        monoEnv,
        t.Record( node, [ t.RowSet(_.mapValues(rowTypings, r => r.type )) ] )
      )

    break; case 'MemberExpression':
      log("> ObjectExpression")
      var recordTyping = inferExpr(env, node.object)

      if ( node.property.type !== 'Identifier' ) {
        // TODO: Better error message (show location in source code)
        fail(`Only named e.g. (.x) are allowed for object keys`)
      }

      var label = node.property.name

      if ( recordTyping.type.tag !== 'Record' ) {
        throw new Errors.NotAnObjectTypeError(env, node, recordTyping, label)
      }

      var memberType = recordTyping.type.lookupLabelType(label)

      if ( ! memberType ) {
        throw new Errors.NoSuchPropertyTypeError(env, node, recordTyping, label)
      }

      //
      // Record members are only monotypes, and not full typings.
      // However, the record itself contains necessary monoEnv restrictions.
      // Return such restrictions along with the member type.
      //
      return Typing(
        recordTyping.monoEnv,
        memberType
      )

    break; case 'ConditionalExpression':

      var ifTyping   = inferExpr(env, node.test)
      var thenTyping = inferExpr(env, node.consequent)
      var elseTyping = inferExpr(env, node.alternate)

      var substitutions = unifyMonoEnvs(
        _.identity, // TODO: Conditional-specific error
        env,
        [ ifTyping.monoEnv, thenTyping.monoEnv, elseTyping.monoEnv ],
        [
          // Constraint #1: The test part of the conditional must be a boolean
          t.Constraint( ifTyping.type,   t.TermBool(node.test) ),

          // Constraint #2: The two branches must be the same type
          t.Constraint( thenTyping.type, elseTyping.type ),
        ]
      )

      // Δ = 𝚿Δ_1 ∪ 𝚿Δ_2
      var monoEnv = Typing.substituteAndAggregateMonoEnvs(
        substitutions,
        [ifTyping.monoEnv, thenTyping.monoEnv, elseTyping.monoEnv]
      )

      return Typing(
        monoEnv,
        t.applySubs(substitutions, thenTyping.type)
      )

    default:
      throw new Error("Expression not supported: " + node.type)
  }

}

function defFunction (env, node, functionName) {
  log('[Def]')
  //
  // [Def], p.37
  //
  // Create new environment (scope) before descending into function body
  var functionEnv = Env(env)

  //
  // Δ_1 |- P_1 :: 𝞣_1
  // ...
  // Δ_n |- P_n :: 𝞣_n
  //
  // Assign a type variable to each parameter,
  // and also add to function environment.
  //
  var paramTypings = node.params.map(function(p) {
    if (p.type !== 'Identifier') fail("Destructuring not yet supported")

    let typeVar = t.TypeVar(p)
    let typing = Typing({ [p.name]: typeVar }, typeVar)
    functionEnv.assign( p.name, typing )

    return typing
  })

  //
  // Γ, Δ' ⊢ E :: 𝞣_0
  //
  var bodyTyping = (node.body.type === 'BlockStatement')
    ? inferFunctionBody(functionEnv, node.params.map(p => p.name), node.body)
    : inferExpr(functionEnv, node.body)

  //
  // Δ_0 = { f :: 𝞣_1 -> ... -> 𝞣_n -> 𝞣_0 }
  //
  // Build mono environment with only function as a constraint.
  //
  var functionType = t.Arrow(
    node,
    paramTypings.map( pt => pt.type ),
    bodyTyping.type
  )
  var functionMonoEnv = { [functionName]: functionType }

  //
  // 𝚿 = 𝓤({ Δ_0, Δ_1, ..., Δ_n, Δ' })
  //
  // Ensure types of params and function body all agree.
  //
  var substitutions = unifyMonoEnvs(
    _.identity,
    functionEnv,
    paramTypings.map( pt => pt.monoEnv ).concat([ bodyTyping.monoEnv ])
  )

  //
  // Δ = 𝚿Δ_0 ∪ 𝚿Δ' \ U[ i=1..n; dom( Δ_i ) ]
  //
  // Apply all substitutions to get the final inferred
  // function mono environment.
  //

  // 𝚿Δ_0 ∪ 𝚿Δ'
  var allConstraints = Typing.substituteAndAggregateMonoEnvs(
    substitutions,
    [functionMonoEnv, bodyTyping.monoEnv]
  )

  // \ U[ i=1..n; dom( Δ_i ) ]
  // Each param typing type should be a type variable.
  // TODO: Handle destructuring
  var paramNames = node.params.map( p => p.name )
  var finalMonoEnv = _.omit(
    allConstraints,
    (c, varName) => _.includes(paramNames, varName)
  )

  // For final type, pull out of substitution-applied finalMonoEnv.
  return Typing( finalMonoEnv, finalMonoEnv[functionName] )
}


function absFunction (env, node) {
  log('[Abs]')
  //
  // [Abs] and [Abs'], p.34
  //
  // Create new environment (scope) before descending into function body
  var functionEnv = Env(env)

  //
  // Assign a type variable to each parameter,
  // and also add to function environment.
  //
  var paramTypings = node.params.map(function(p) {
    if (p.type !== 'Identifier') fail("Destructuring not yet supported")

    let typeVar = t.TypeVar(p)
    let typing = Typing({ [p.name]: typeVar }, typeVar)
    functionEnv.assign( p.name, typing )

    return typing
  })

  //
  // Γ, Δ ⊢ E :: 𝞣
  //
  var bodyTyping = (node.body.type === 'BlockStatement')
    ? inferFunctionBody(functionEnv, node.params.map(p => p.name), node.body)
    : inferExpr(functionEnv, node.body)

  //
  // Pull final types of parameters from body typing's monoEnv
  //
  var paramTypes = node.params.map( (p,i) => bodyTyping.monoEnv[p.name] )

  //
  // Allow let-polymorphism by removing params from the monoEnv
  //
  var lambdaTyping = Typing(
    _.omit( bodyTyping.monoEnv, ...node.params.map(p => p.name) ),
    bodyTyping.type
  )

  //
  // Combine for full lambda typing
  //
  return Typing(
    lambdaTyping.monoEnv,
    t.Arrow(node, paramTypes, bodyTyping.type)
  )
}


function litTermFromNode (node) {
  switch (typeof node.value) {
    case 'number':  return t.TermNum(node)
    case 'string':  return t.TermString(node)
    case 'boolean': return t.TermBool(node)
  }
  fail("No such type from literal: " + node.value)
}

var log = function () {
  if (! process.env.DEBUG_TYPES) return
  console.log.apply(console, [].slice.call(arguments))
}

var inspect = (obj) => util.inspect(obj, { showHidden: false, depth: null })
