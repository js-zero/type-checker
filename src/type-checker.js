/*
 * Great thanks to http://cs.brown.edu/courses/cs173/2012/book/types.html
 */
var ESTraverse = require('estraverse')
var Scope = require('./lib/scope')
var t = require('./types')
var pretty = require('./pretty')
var util = require('util')
var inspect = function (obj) { return util.inspect(obj, { showHidden: false, depth: null }) }
var fail = require('./lib/assert').fail
var flattenOneLevel = require('./lib/util').flattenOneLevel
var pushAll = require('./lib/util').pushAll

exports.typeCheck = function (ast, scopes) {

  var results = generateConstraints(scopes, ast)
  log("AST (with _id's):", inspect(ast))
  log("\n----\nGOT constraints: (", +results.constraints.length+ ")", inspect(results.constraints))
  // console.log("GOT constraints: (" +constraints.length+ ")", inspect(constraints))

  var substitutions = unify(results.constraints, [], results.nodeMap)
  log("GOT Substitutions (", substitutions.length, " )\n", inspect(substitutions))
}


function generateConstraints (scopes, rootNode) {
  var idCounter = 1
  var constraints = []
  var nodeMap = {}
  var scopeChain = [Scope(null)]

  function assignRefId (node) {
    if (! node._id) {
      node._id = (idCounter += 1)
      nodeMap[node._id] = node
      return node._id
    }
    else {
      throw new Error("Node already has an id:\n" + JSON.stringify(node))
    }
  }

  function findVariable (varName) {
    for (var i = 0; i < scopeChain.length; i++){
      var scope = scopeChain[i]
      if (scope.ids[varName]){
        return scope.ids[varName]
      }
    }
  }

  function lookup (id) {
    // TODO: Handle object member expressions
    var existingId = nodeMap[id._id] || findVariable(id.name)

    if ( ! existingId) {
      fail(`Not in scope: ${id.name}\n${JSON.stringify(scopeChain)}`)
    }
    else if ( ! existingId._id ) {
      // Relate this identifier to existing identifier
      existingId._id = id._id
    }

    return existingId
  }

  function ensureUndefined (id) {
    return findVariable(id.name) &&
           fail(`Variable \`${id.name}\` is already defined.`)
  }
  // constraints.push = function () {
  //   console.log("New constraint:", inspect(arguments[0]))
  //   ;[].push.apply(constraints, arguments)
  // }

  var constraints = traverse({ assignRefId, lookup, scopeChain, ensureUndefined }, rootNode)

  return { constraints, nodeMap }
}

function traverse (ctx, node) {

  switch(node.type) {

    //
    // Transient nodes
    //
    case 'Program':
    case 'BlockStatement':
      return flattenOneLevel(
        node.body.map( n => traverse(ctx, n) )
      )

    case 'VariableDeclaration':
      return flattenOneLevel(
        node.declarations.map( n => traverse(ctx, n) )
      )

    case 'ExpressionStatement':
      return traverse(ctx, node.expression)


    //
    // Constraint-generating nodes
    //
    case 'ReturnStatement':
      var scope = ctx.scopeChain[ctx.scopeChain.length-1]

      // Record expression for later use by function type generator
      scope.returnExprs.push(node.argument)

      return traverse(ctx, node.argument)

    case 'Literal':
      log("> Literal")
      ctx.assignRefId(node)
      return [
        t.Const( t.TermExpr(node), litTermFromNode(node) )
      ]

    case 'Identifier':

      // Ensure identifier is in scope
      ctx.lookup(node)

      return []


    case 'VariableDeclarator':
      log("> VariableDeclarator")

      if ( ! node.init ) {
        // TODO: Better error message
        throw new Error("Uninitialized variable: " + node.id.name)
      }

      ctx.assignRefId(node.id)

      // Add variable to current scope
      var scope = ctx.scopeChain[ctx.scopeChain.length-1]
      scope.ids[node.id.name] = node.id

      return traverse(ctx, node.init).concat([
        t.Const( t.TermVar(node.id), t.TermExpr(node.init) )
      ])

    case 'BinaryExpression':
      log("> BinaryExpression")
      ctx.assignRefId(node)

      var constraints = flattenOneLevel(
        traverse(ctx, node.left),
        traverse(ctx, node.right)
      )

      return constraints.concat([
        // All operators should have a type sig (a, b) => c
        // TODO: Expand for more than just (+)
        t.Const( ExprOrVar(ctx, node.left),  t.TermNum(node.left) ),
        t.Const( ExprOrVar(ctx, node.right), t.TermNum(node.right) ),
        t.Const( t.TermExpr(node),           t.TermNum(node) )
      ])

    case 'FunctionDeclaration':
      log("> FunctionDeclaration")

      ctx.ensureUndefined(node.id)

      ctx.assignRefId(node.id)
      ctx.assignRefId(node.body)

      // Add function name to current scope
      var scope = ctx.scopeChain[ctx.scopeChain.length-1]
      scope.ids[node.id.name] = node.id

      // Create new scope before descending into function body
      var functionScope = Scope(node.id)

      // Create a local variable for each parameter,
      // as well as assign them reference ids.
      for (var paramNode of node.params) {
        ctx.assignRefId(paramNode)
        functionScope.ids[paramNode.name] = paramNode
      }
      ctx.scopeChain.push(functionScope)


      var bodyConstraints = traverse(ctx, node.body)

      //
      // Construct function type constraint
      //
      var returnType = (scope.returnExprs.count === 0)
        ? t.TermUndefined(node.body)
        : t.TermExpr(node.body)

      var functionType = t.TermArrow(node, node.params.map(t.TermVar), returnType)

      var returnConstraints = functionScope.returnExprs.map(
        e => t.Const( ExprOrVar(ctx, e), returnType )
      )

      //
      // Pop scope before moving on
      //
      ctx.scopeChain.pop()

      return flattenOneLevel([
        bodyConstraints,
        returnConstraints,
        [t.Const( t.TermVar(node.id), functionType )]
      ])

    case 'CallExpression':
      log("> CallExpression")
      ctx.assignRefId(node)

      var constraints = flattenOneLevel(
        node.arguments.map( arg => traverse(ctx, arg) )
      )

      return constraints.concat([
        t.Const(
          ExprOrVar(ctx, node.callee),
          t.TermArrow( node,
                       node.arguments.map( a => ExprOrVar(ctx, a) ),
                       t.TermExpr(node) )
        )
      ])

    default:
      throw new Error("Node not supported: " + node.type)
  }

}

function generateConstraint (scopes, node) {
  log("Inspecting", node.type)
}


var unify = function (constraints, substitutions, nodeMap) {
  if (constraints.length === 0) return substitutions

  var cs = constraints.pop()
  var left = cs.left
  var right = cs.right
  log("\n\n----\nUnifying", inspect(left), "\nAnd\n", inspect(right))
  log("====Constraints====\n", inspect(constraints))
  log("====Substitutions====\n", inspect(substitutions))
  if (t.eq(left, right)) {
    log("Unified " + left.tag)
    return unify(constraints, substitutions, nodeMap)
  }

  // Because term vars/exprs can be on either side, we check both here
  if (left.tag === 'TermVar' || left.tag === 'TermExpr') {
    log("=> Extend+Replace (left)")
    return unify(exrConsts(cs, constraints), exrSubsts(cs, substitutions), nodeMap)
  }
  else if (right.tag === 'TermVar' || right.tag === 'TermExpr') {
    log("=> Extend+Replace (right)")
    var csSwapped = { left: cs.right, right: cs.left }
    return unify(exrConsts(csSwapped, constraints), exrSubsts(csSwapped, substitutions), nodeMap)
  }

  // Otherwise, we only care about the left side
  switch (left.tag) {
    case 'TermArrow':

      if (right.tag === 'TermArrow') {
        var newConstraints = [
          t.Const(left.range, right.range)
        ].concat(
          zip(left.domain, right.domain).map( terms => t.Const.apply(null, terms) )
        )
        log("=> Pushing new constraints from Arrow:", inspect(newConstraints))
        pushAll(constraints, newConstraints)
        return unify(constraints, substitutions, nodeMap)
      }
      else {
        throw new Error('cannot unify `TermArrow` and `' + right.tag + '`')
      }

    case 'TermNum':
    case 'TermBool':
    case 'TermString':
    case 'TermUndefined':
      if (right.tag === left.tag) {
        log("Unified " + left.tag)
        return unify(constraints, substitutions, nodeMap)
      }

    default:
      var leftPos = t.posNode(left)
      var rightPos = t.posNode(right)

      var leftNode = left.source || nodeMap[left._id]
      var rightNode = right.source || nodeMap[right._id]

      throw new Error(`
cannot unify \`${pretty.type(left)}\` and \`${pretty.type(right)}\`
    ${left.tag}: ${pretty.node(leftNode)} at line ${leftNode.loc.start.line} col ${leftNode.loc.start.column+1}
    ${right.tag}: ${pretty.node(rightNode)} at line ${rightNode.loc.start.line} col ${rightNode.loc.start.column+1}
`)
  }

}

var exrConsts = extendAndReplace.bind(null, 'const', t.Const)
var exrSubsts = function (cs, substitutions) {
  var newSubs = extendAndReplace('subst', t.Subst, cs, substitutions)
  newSubs.push(t.Subst(cs.left, cs.right))
  return newSubs
}
function extendAndReplace (type, typeConstructor, cs, substitutions) {
  // TODO: occurs check
  log(`${cs.left.tag} ${cs.left._id} = ${cs.right.tag} ${cs.right._id}`)
  var results = []
  for (var i=0; i < substitutions.length; i++) {
    var subst = substitutions[i]
    log("  ["+type+"] checking against", subst.left.tag, subst.left._id, "=", subst.right.tag, subst.right._id)
    if (t.eq(subst.left, cs.left)) {
      log("! ["+type+"] Replacing", subst.left, "with", cs.right)
      subst = typeConstructor(cs.right, subst.right)
    }
    else if (t.eq(subst.right, cs.left)) {
      log("!.["+type+"] Replacing", subst.right, "with", cs.right)
      subst = typeConstructor(subst.left, cs.right)
    }
    else if (subst.right.tag === 'TermArrow') {
      subst.right.domain = subst.right.domain.map(function(term) {
        log("  ["+type+"][arrow] checking against", term.tag, term._id)
        if (t.eq(term, cs.left)) {
          log("! ["+type+"][arrow] Replacing", term, "with", cs.right)
          return cs.right
        }
        else return term
      })
      var range = subst.right.range
      log("  ["+type+"][arrow] checking range against", range.tag, range._id)
      if (t.eq(range, cs.left)) {
        log("! ["+type+"][arrow] Replacing range", range, "with", cs.right)
        subst.right.range = cs.right
      }
    }
    results.push(subst)
  }
  return results
}

function litTermFromNode (node) {
  switch (typeof node.value) {
    case 'number': return t.TermNum(node)
    case 'string': return t.TermString(node)
  }
  fail("No such type from literal: " + node.value)
}

function ExprOrVar (ctx, node) {
  if (node.type === 'Identifier') return t.TermVar(ctx.lookup(node))
  else                            return t.TermExpr(node)
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
