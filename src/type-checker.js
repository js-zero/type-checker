'use strict'
/*
 * Great thanks to http://cs.brown.edu/courses/cs173/2012/book/types.html
 */
var ESTraverse = require('estraverse')
var Scope = require('./lib/scope')
var ErrorReporter = require('./error-reporter')

var Env     = require('./lib/environment')
var Typing  = require('./lib/typing')
var NodeMap = require('./lib/node-map')
var t      = require('./types')

var util = require('util')
var inspect = function (obj) { return util.inspect(obj, { showHidden: false, depth: null }) }
var fail = require('./lib/assert').fail

var utilLib = require('./lib/util')
var flattenOneLevel = utilLib.flattenOneLevel
var pushAll         = utilLib.pushAll
var extend          = utilLib.extend
var objMap          = utilLib.objMap
var objFilter       = utilLib.objFilter

exports.typeCheck = function (ast, scopes) {

  var env = Env(null)
  var nodeMap = NodeMap()

  try {
    var env_ = buildEnv(nodeMap, env, ast)
    log("\n----\nGOT environment:", inspect(env_))
    return env_
  }
  catch (errorContext) {
    log("ERROR", errorContext)
    // ErrorReporter.report(ast, errorContext)
    throw errorContext
  }
}


function buildEnv (nodeMap, env, node) {

  switch(node.type) {

    //
    // Transient nodes
    //
    case 'Program':
    case 'BlockStatement':
      // Every statement can potentially add to the environment (e.g. `let` statements).
      node.body.forEach( n => buildEnv(nodeMap, env, n) )
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

      var typing = inferExpr(nodeMap, env, decl.init)
      return env.assign( decl.id.name, typing)

    break; case 'ExpressionStatement':
      return buildEnv(nodeMap, env, node.expression)

    default:
      throw new Error("Statement not supported: " + node.type)
  }
}



function inferExpr (nodeMap, env, node) {

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


    break; case 'Identifier':
      log("> Identifier", node.name)

      // [PolyVar], p.33
      return env.lookup(node.name).instantiate()


    break; case 'BinaryExpression':
      log("> BinaryExpression", node.operator)

      //
      // TODO: Handle binary operators other than +
      //

      var leftTyping = inferExpr(nodeMap, env, node.left)
      var rightTyping = inferExpr(nodeMap, env, node.right)

      var substitutions = unifyMonoEnvs(nodeMap, [
        leftTyping.monoEnv,
        rightTyping.monoEnv
      ], [
        t.Constraint( leftTyping.type, t.TermNum(node.left) ),
        t.Constraint( rightTyping.type, t.TermNum(node.right) )
      ])

      // Δ = 𝚿Δ_1 ∪ 𝚿Δ_2
      var subAll = (type) =>
        substitutions.reduce( (ty, sub) => t.substitute(sub, ty), type )

      var constraints = extend(
        objMap( leftTyping.monoEnv, subAll ),
        objMap( rightTyping.monoEnv, subAll )
      )

      return Typing(constraints, t.TermNum(node))

      // if (leftType.tag === 'TermNum' && leftType.tag === 'TermNum') {
      //   // TODO: Store types (somewhere?)
      //   return t.TermNum(node)
      // }
      // else if (leftType.tag === 'TermString' && leftType.tag === 'TermString') {
      //   return t.TermString(node)
      // }
      // else {
      //   fail(`Cannot unify ${leftType.tag} and ${rightType.tag}`)
      // }

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

      // For later reference
      node.env = functionEnv

      //
      // Γ, Δ' ⊢ E :: 𝞣_0
      // TODO: block bodies with `return` statements
      // buildEnv(nodeMap, functionEnv, node.body)
      //
      var bodyTyping = inferExpr( nodeMap, functionEnv, node.body )

      //
      // Δ_0 = { f :: 𝞣_1 -> ... -> 𝞣_n -> 𝞣_0 }
      //
      // Build mono environment with only function as a constraint.
      //
      var paramTypes = paramTypings.map( pt => pt.type )
      var functionType = t.TermArrow( node, paramTypes, bodyTyping.type )
      var functionMonoEnv = { [node._name]: functionType }

      //
      // 𝚿 = 𝓤({ Δ_0, Δ_1, ..., Δ_n, Δ' })
      //
      // Ensure types of params and function body all agree.
      //
      var substitutions = unifyMonoEnvs(
        nodeMap,
        paramTypings.map( pt => pt.monoEnv ).concat([ bodyTyping.monoEnv ])
      )

      //
      // Δ = 𝚿Δ_0 ∪ 𝚿Δ' \ U[ i=1..n; dom( Δ_i ) ]
      //
      // Apply all substitutions to get the final inferred
      // function mono environment.
      //
      var subAll = (type) =>
        substitutions.reduce( (ty, sub) => t.substitute(sub, ty), type )

      // 𝚿Δ_0 ∪ 𝚿Δ'
      var allConstraints = extend(
        objMap( functionMonoEnv, subAll ),
        objMap( bodyTyping.monoEnv, subAll )
      )

      // \ U[ i=1..n; dom( Δ_i ) ]
      // Each param typing type should be a type variable.
      // TODO: Handle destructuring
      var paramTypeVarIds = paramTypings.map( pt => pt.type._id )
      var constraints = objFilter(
        allConstraints,
        c => c.tag !== 'TypeVar' || paramTypeVarIds.indexOf(c._id) === 0
      )

      // For final type, pull out of substitution-applied constraints.
      return Typing( constraints, constraints[node._name] )


      //
      // Construct function type constraint
      //

    break; case 'CallExpression':
      log("> CallExpression")
      ctx.assignRef(node)

      var constraints = flattenOneLevel(
        node.arguments.map( arg => traverse(ctx, arg) )
      )

      return constraints.concat([
        t.Constraint(
          ExprOrVar(ctx, node.callee),
          t.TermArrow( node,
                       node.arguments.map( a => ExprOrVar(ctx, a) ),
                       t.TermExpr(node) )
        )
      ])

    default:
      throw new Error("Expression not supported: " + node.type)
  }

}

//
// [5.4] Unification of typings (p.32)
//
function unifyMonoEnvs (nodeMap, monoEnvs, existingConstraints) {
  log("-=-=-\n[unifyMono]\n", monoEnvs)
  var varTypeMap = {}

  // Gather all variable usage, grouped by variable name
  monoEnvs.forEach(function(mEnv) {
    for (var varName in mEnv) {
      varTypeMap[varName] || (varTypeMap[varName] = [])
      varTypeMap[varName].push( mEnv[varName] )
    }
  })

  //
  // For each array of variable usages,
  // create a fresh type variable for all to agree on.
  //
  var constraints = flattenOneLevel(
    Object.keys(varTypeMap).map(function(varName) {
      var usages = varTypeMap[varName]
      var freshTypeVar = t.TypeVar(null)
      return usages.map( u => t.Constraint( freshTypeVar, u ) )
    })
  )

  return unify(nodeMap, constraints.concat(existingConstraints || []))
}

function unify (nodeMap, constraints) {
  if (constraints.length === 0) return []

  var cs = constraints.shift()
  var left = cs.left
  var right = cs.right
  log("\n\n----\nUnifying", inspect(left), "\nAnd\n", inspect(right))
  log("====Constraints====\n", inspect(constraints))
  if (t.eq(left, right)) {
    log("Unified " + left.tag)
    return unify(nodeMap, constraints)
  }
  else if (right.tag === 'TypeVar' && left.tag !== 'TypeVar') {
    // To simplify the algorithm,
    // always ensure a present type variable is on the left side.
    var csSwapped = { left: cs.right, right: cs.left }
    cs = csSwapped
    left = csSwapped.left
    right = csSwapped.right
    log("[[[[Swapped]]]]")
  }


  switch (left.tag) {

    case 'TypeVar':
      return [ t.Substitution(cs.left, cs.right) ].concat(
        unify(nodeMap, substituteConstraints(cs, constraints))
      )

    case 'TermArrow':

      if (right.tag === 'TermArrow') {
        var newConstraints = [
          t.Constraint(left.range, right.range)
        ].concat(
          zip(left.domain, right.domain).map( terms => t.Constraint.apply(null, terms) )
        )
        log("=> Pushing new constraints from Arrow:", inspect(newConstraints))
        pushAll(constraints, newConstraints)
        return unify(nodeMap, constraints)
      }

    case 'TermNum':
    case 'TermBool':
    case 'TermString':
    case 'TermUndefined':
      if (right.tag === left.tag) {
        log("Unified " + left.tag)
        return unify(nodeMap, constraints)
      }

    default:
      var leftNode = left.source || nodeMap[left._id]
      var rightNode = right.source || nodeMap[right._id]

      throw { leftNode, leftType: left, rightNode, rightType: right }
  }

}

// Exported for testing
exports.substituteConstraints = substituteConstraints

function substituteConstraints (sub, constraints) {
  // TODO: occurs check
  log(`${sub.left.tag} ${sub.left._id || ''} = ${sub.right.tag} ${sub.right._id || ''}`)

  return constraints.map(function (c) {
    log("  [sub] checking against", c.left.tag, c.left._id || '', "=", c.right.tag, c.right._id || '')

    if (t.eq(c.left, sub.left)) {
      log("! [sub] Replacing", c.left, "with", sub.right)
      return t.Constraint(sub.right, c.right)
    }
    else if (t.eq(c.right, sub.left)) {
      log("!.[sub] Replacing", c.right, "with", sub.right)
      return t.Constraint(c.left, sub.right)
    }
    else if (c.right.tag === 'TermArrow') {
      c.right.domain = c.right.domain.map(function(term) {
        log("  [sub][arrow] checking against", term.tag, term._id)
        if (t.eq(term, sub.left)) {
          log("! [sub][arrow] Replacing", term, "with", sub.right)
          return sub.right
        }
        else return term
      })
      var range = c.right.range
      log("  [sub][arrow] checking range against", range.tag, range._id)
      if (t.eq(range, sub.left)) {
        log("! [sub][arrow] Replacing range", range, "with", sub.right)
        c.right.range = sub.right
      }
      return c
    }
    else {
      // No substitutions to make.
      return c
    }
  })
}

function litTermFromNode (node) {
  switch (typeof node.value) {
    case 'number': return t.TermNum(node)
    case 'string': return t.TermString(node)
  }
  fail("No such type from literal: " + node.value)
}

function zip (a, b) {
  var results = []
  for (var i=0; i < a.length; i++) {
    results.push([a[i], b[i]])
  }
  return results
}

var log = function () {
  if (! process.env.DEBUG_TYPES) return
  console.log.apply(console, [].slice.call(arguments))
}
