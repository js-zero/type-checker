
//
// Any types generated from annotations should specify its source as this.
//
exports.ANNOTATION = {}

// (Fresh) Type Variable
var varIdCounter = 5000;
exports.TypeVar = function (sourceNode) {
  varIdCounter += 1
  return { tag: 'TypeVar', source: includeSource && sourceNode, _id: varIdCounter }
}

//
// A NamedTypeVar will take form of the first type variable it
// sees in the `eq` algorithm.
//
exports.NamedTypeVar = function (name) {
  return { tag: 'TypeVar', name: name, _id: null }
}

// Concrete types
exports.TermNum = function (sourceNode) {
  return { tag: 'TermNum', source: includeSource && sourceNode }
}
exports.TermBool = function (sourceNode) {
  return { tag: 'TermBool', source: includeSource && sourceNode }
}
exports.TermString = function (sourceNode) {
  return { tag: 'TermString', source: includeSource && sourceNode }
}
exports.TermUndefined = function (sourceNode) {
  return { tag: 'TermUndefined', source: includeSource && sourceNode }
}
exports.Arrow = function (sourceNode, domain, range) {
  return { tag: 'Arrow', domain: domain, range: range, source: includeSource && sourceNode }
}
exports.ConArray = function (sourceNode, elemType) {
  return {
    tag: 'Con',
    name: 'Array',
    args: [elemType],
    source: includeSource && sourceNode,
    constructor: exports.ConArray
  }
}


exports.Constraint = function (left, right) {
  return { tag: 'Constraint', left: left, right: right }
}

exports.Substitution = function (typeVariable, value) {
  return { tag: 'Substitution', left: typeVariable, right: value }
}

// Records
var Record = require('./records')
exports.Record = Record
exports.RowTypeVar = Record.RowTypeVar
exports.NamedRowTypeVar = Record.NamedRowTypeVar

// Debugging
var includeSource = process.env.DEBUG_TYPES ? false : true
