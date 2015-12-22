exports.eq = eq
exports.substitute = substitute
exports.freshTypeVar = freshTypeVar

exports.Constraint = function (left, right) {
  return { tag: 'Constraint', left: left, right: right }
}

// Debugging
var includeSource = (process.env.HIDE_SOURCE_NODES && false) || true

// (Fresh) Type Variable
var varIdCounter = 5000;
exports.TypeVar = function (sourceNode) {
  varIdCounter += 1
  return { tag: 'TypeVar', source: includeSource && sourceNode, _id: varIdCounter }
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
exports.TermArrow = function (sourceNode, domain, range) {
  return { tag: 'TermArrow', domain: domain, range: range, source: includeSource && sourceNode }
}
exports.TermPlaceholder = {}

// (Term, Term) => Subst
exports.Substitution = function (variable, subVal) {
  return { tag: 'Substitution', left: variable, right: subVal }
}

function eq (a, b) {
  if (a.tag === 'TermNum'
   || a.tag === 'TermBool'
   || a.tag === 'TermString'
   || a.tag === 'TermUndefined'
  ) {
    return b.tag === a.tag
  }
  else if (a.tag === 'TypeVar') {
    return b.tag === 'TypeVar' && a._id === b._id
  }
  else if (a.tag === 'TermArrow') {
    return b.tag === 'TermArrow'
        && arrayEq(a.domain.map( p => p._ref ), b.domain.map( p => p._ref ))
        && a.range._ref === b.range._ref
  }
  else {
    throw Error("Unrecognized type.")
  }
}


function arrayEq (a, b) {
  if (a.length !== b.length) return false
  for (var i=0; i < a.length; i++) {
    if (a[i] instanceof Array && ! arrayEq(a[i], b[i])) return false
    if (a[i] !== b[i]) return false
  }
  return true
}

function substitute (sub, type) {
  if ( type.tag === 'TermArrow' ) {
    return exports.TermArrow(
      type.source,
      type.domain.map( term => substitute(sub, term) ),
      substitute( sub, type.range )
    )
  }
  else if ( eq(sub.left, type) ) {
    // Retain original source node
    return Object.assign(sub.right, { source: type.source })
  }
  else {
    return type
  }
}

function freshTypeVar (cache, type) {
  if ( type.tag === 'TypeVar' ) {
    if ( ! cache[type._id] ) {
      cache[type._id] = exports.TypeVar(type.source)
    }
    return cache[type._id]
  }
  else if ( type.tag === 'TermArrow' ) {
    return exports.TermArrow(
      type.source,
      type.domain.map( term => freshTypeVar(cache, term) ),
      freshTypeVar( cache, type.range )
    )
  }
  else {
    return type
  }
}
