var _       = require('lodash')
var Record  = require('./records')

exports.eq = eq
exports.substitute   = substitute
exports.applySubs    = applySubs
exports.freshTypeVar = freshTypeVar

exports.Constraint = function (left, right) {
  return { tag: 'Constraint', left: left, right: right }
}

// Debugging
var includeSource = process.env.HIDE_SOURCE_NODES ? false : true

exports.withSource = function (source, type) {
  return Object.assign({}, type, { source: source })
}

// (Fresh) Type Variable
var varIdCounter = 5000;
exports.TypeVar = function (sourceNode) {
  varIdCounter += 1
  return { tag: 'TypeVar', source: includeSource && sourceNode, _id: varIdCounter }
}

// Re-export record types
exports.Record = Record
exports.RowTypeVar = Record.RowTypeVar

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
exports.TermArray = function (sourceNode, elemType) {
  return { tag: 'TermArray', elemType: elemType, source: includeSource && sourceNode }
}

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
  else if (a.tag === 'RowTypeVar') {
    return b.tag === 'RowTypeVar' && a._id === b._id
  }
  else if (a.tag === 'TermArray') {
    return b.tag === 'TermArray' && eq(a.elemType, b.elemType)
  }
  else if (a.tag === 'TermArrow') {
    return b.tag === 'TermArrow'
        && arrayEq(a.domain.map( p => p._ref ), b.domain.map( p => p._ref ))
        && a.range._ref === b.range._ref
  }
  else if (a.tag === 'Record') {
    return b.tag === 'Record' && Record.isEq(eq, a, b)
  }
  else {
    throw Error(`Unrecognized type: ${ JSON.stringify(a) }`)
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
  if ( ! type ) return type

  if ( type.tag === 'TermArrow' ) {
    return exports.TermArrow(
      type.source,
      type.domain.map( term => substitute(sub, term) ),
      substitute( sub, type.range )
    )
  }
  else if ( type.tag === 'Record' ) {
    return Record(
      type.source,
      _.mapValues( type.rows, typing => typing.substitute(sub) ),
      substitute( sub, type.polyVar )
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

function applySubs (substitutions, type) {
  return substitutions.reduce( (ty, sub) => substitute(sub, ty), type )
}


function freshTypeVar (cache, type) {
  if ( ! type ) return type

  if ( type.tag === 'TypeVar' ) {
    if ( ! cache[type._id] ) {
      cache[type._id] = exports.TypeVar(type.source)
    }
    return cache[type._id]
  }
  else if ( type.tag === 'RowTypeVar' ) {
    if ( ! cache[type._id] ) {
      cache[type._id] = Record.RowTypeVar(type.source)
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
  else if ( type.tag === 'Record' ) {
    return Record(
      type.source,
      _.mapValues( type.rows, typing => typing.instantiate(cache) ),
      freshTypeVar(cache, type.polyVar)
    )
  }
  else {
    return type
  }
}
