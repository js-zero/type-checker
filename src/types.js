var extend = require('./lib/util').extend

exports.eq = eq
exports.posNode = posNode

exports.Any = function () {
  return { type: 'type', name: 'Any', args: [] }
}

exports.Const = function (left, right) {
  return { tag: 'Const', left: left, right: right }
}
exports.TermExpr = function (node) {
  return { tag: 'TermExpr', _id: node._id }
}
exports.TermVar = function (id) {
  return { tag: 'TermVar', id: id, _id: id._id }
}
exports.TermNum = function (sourceNode) {
  return { tag: 'TermNum', source: sourceNode }
}
exports.TermBool = function (sourceNode) {
  return { tag: 'TermBool', source: sourceNode }
}
exports.TermString = function (sourceNode) {
  return { tag: 'TermString', source: sourceNode }
}
exports.TermUndefined = function (sourceNode) {
  return { tag: 'TermUndefined', source: sourceNode }
}
exports.TermArrow = function (sourceNode, domain, range) {
  return { tag: 'TermArrow', domain: domain, range: range, source: sourceNode }
}

// (Term, Term) => Subst
exports.Subst = function (variable, subVal) {
  return { tag: 'Subst', left: variable, right: subVal }
}

function eq (a, b) {
  if (a.tag === 'TermNum'
   || a.tag === 'TermBool'
   || a.tag === 'TermString'
   || a.tag === 'TermUndefined'
  ) {
    return a.tag === b.tag
  }
  else if (a.tag === 'TermArrow' && b.tag === 'TermArrow') {
    return arrayEq(a.domain.map( p => p._id ), b.domain.map( p => p._id ))
        && a.range._id === b.range._id
  }
  else if (a._id && b._id) {
    return a._id === b._id
  }
  return false
}


function posNode (term) {
  if (term.tag === 'TermExpr') return term.expr
  if (term.tag === 'TermVar') return term.id
  if (term.tag === 'TermArrow') return posNode(term.range)
  else return term.node
}

function arrayEq (a, b) {
  if (a.length !== b.length) return false
  for (var i=0; i < a.length; i++) {
    if (a[i] instanceof Array && ! arrayEq(a[i], b[i])) return false
    if (a[i] !== b[i]) return false
  }
  return true
}
