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


exports.typeCheck = function (ast, scopes) {

  var env = Env(null)

  try {
    buildEnv(env, ast)
    log("\n----\nGOT environment:", env)
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
      node.body.forEach( n => buildEnv(env, n) )
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

        var parts = node.expression.quasi.quasis[0].value.raw.split(':')
        if ( parts.length !== 2 ) {
          throw new Error(`A type annotation must have two parts separated by a colon, e.g. myFunc : Num`)
        }

        var varName = _.trim(parts[0])
        var typeAssumption = compileAnnotation( parts[1] )

        return env.assume( varName, Typing({}, typeAssumption) )
      }
      else {
        return inferExpr(env, node.expression)
      }

    default:
      throw new Error("Statement not supported: " + node.type)
  }
}



function inferExpr (env, node) {

  switch(node.type) {

    //
    // Constraint-generating nodes
    //
    case 'ReturnStatement':
      // Record expression for later use by function type generator
      // scope.returnExprs.push(node.argument)

      return inferExpr(ctx, node.argument)


    break; case 'Literal':
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

      //
      // TODO: Handle binary operators other than +
      //

      var leftTyping = inferExpr(env, node.left)
      var rightTyping = inferExpr(env, node.right)

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

    break; case 'ArrowFunctionExpression':
      //
      // [Def], p.37
      //
    // TODO: Use [Def] only if node._name exists.
    //       Otherwise, use [Abs] and [Abs']
      log("> ArrowFunctionExpression")

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
      // TODO: block bodies with `return` statements
      // buildEnv(functionEnv, node.body)
      //
      var bodyTyping = inferExpr(functionEnv, node.body)

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
      var functionMonoEnv = { [node._name]: functionType }

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
      return Typing( finalMonoEnv, finalMonoEnv[node._name] )

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
      var monoEnvs = argumentTypings.map( at => at.monoEnv ).concat([calleeTyping.monoEnv])
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
        t.Record(node, _.mapValues(rowTypings, r => r.type ), null)
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

      var memberTyping = recordTyping.type.rows[label]

      if ( ! memberTyping ) {
        throw new Errors.NoSuchPropertyTypeError(env, node, recordTyping, label)
      }

      return memberTyping


    default:
      throw new Error("Expression not supported: " + node.type)
  }

}

function litTermFromNode (node) {
  switch (typeof node.value) {
    case 'number': return t.TermNum(node)
    case 'string': return t.TermString(node)
  }
  fail("No such type from literal: " + node.value)
}

var log = function () {
  if (! process.env.DEBUG_TYPES) return
  console.log.apply(console, [].slice.call(arguments))
}
