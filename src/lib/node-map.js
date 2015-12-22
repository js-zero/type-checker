//
// Node Map
//
// This is not part of the type system;
// it's an index of nodes to their typings.
//
// On the first AST pass, typings are null.
// On the second pass, typings are generated and unified.
//
module.exports = function NodeMap () {
  var idCounter = 1
  var typingsByRef = {}
  var nodeMap = {}

  nodeMap.assignRef = function (node) {
    if (! node._ref) {
      node._ref = (idCounter += 1)
      typingsByRef[node._ref] = node
      return node._ref
    }
    else {
      throw new Error("Node already has an id:\n" + JSON.stringify(node))
    }
  }

  nodeMap.check = function (id) {
    // TODO: Handle object member expressions
    var existingId = typingsByRef[id._ref] || findVariable(id.name)

    if ( ! existingId) {
      fail(`Not in scope: ${id.name}\n${JSON.stringify(scopeChain)}`)
    }
    else if ( ! existingId._ref ) {
      // Relate this identifier to existing identifier
      existingId._ref = id._ref
    }

    return existingId
  }

  nodeMap.lookup = function (id) {
    // TODO: Handle object member expressions
    var existingId = typingsByRef[id._ref] || findVariable(id.name)

    if ( ! existingId) {
      fail(`Not in scope: ${id.name}\n${JSON.stringify(scopeChain)}`)
    }
    else if ( ! existingId._ref ) {
      // Relate this identifier to existing identifier
      existingId._ref = id._ref
    }

    return existingId
  }

  return nodeMap
}
