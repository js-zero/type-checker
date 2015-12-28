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

//
// Any types generated from annotations should specify its source as this.
//
exports.ANNOTATION = {}

//
// A NamedTypeVar will take form of the first type variable it
// sees in the `eq` algorithm.
//
exports.NamedTypeVar = function (name) {
  return { tag: 'TypeVar', name: name, _id: null }
}

// Re-export record types
exports.Record = Record
exports.RowTypeVar = Record.RowTypeVar
exports.NamedRowTypeVar = Record.NamedRowTypeVar

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
  return { tag: 'ConArray', elemType: elemType, source: includeSource && sourceNode }
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

    if ( b.tag !== 'TypeVar' ) return false

    //
    // NOTE:
    // This part of the algorithm exists to be able to match
    // generic type annotations (e.g. `(a) => a`)
    // to inferred types (e.g. a type inferred from `let id = (x) => x` ).
    //
    // The reason this is necessary is because type variables are normally
    // compared using their _id. However, type variables from annotations don't
    // have an _id, but still must be "generic" enough to match against inferred
    // type variables.
    //
    // The result what you see here; when a annotated type variable comes into first
    // contact with a "real" type variable, it assumes it matches, and undertakes
    // the "real" type variable's _id.
    //
    // Although this is a nice reuse of code (we don't have to write two `eq` functions),
    // the problem with this approach is that it's brittle; it mutates the type variable.
    // Once an annotation has been matched with a type, it cannot be matched with
    // another type, even if structurally it is the same.
    //
    // Essentially, the code of JS Zero must internally be careful not to attempt to
    // match an annotation across two different types. I don't think this will be
    // needed. However, if it is, a restructure might be necessary.
    //
    if ( a._id === null && b._id === null ) {
      return a.name === b.name
    }
    else if ( a._id === null ) {
      a._id = b._id
      return true
    }
    else if ( b._id === null ) {
      b._id = a._id
      return true
    }
    else {
      return a._id === b._id
    }
  }
  else if (a.tag === 'RowTypeVar') {
    return b.tag === 'RowTypeVar' && a._id === b._id
  }
  else if (a.tag === 'ConArray') {
    return b.tag === 'ConArray' && eq(a.elemType, b.elemType)
  }
  else if (a.tag === 'Arrow') {
    return b.tag === 'Arrow'
        && eq(a.range, b.range)
        && _.chain(a.domain).zip(b.domain).all( d => eq(d[0], d[1]) )
  }
  else if (a.tag === 'Record') {
    return b.tag === 'Record' && Record.isEq(eq, a, b)
  }
  else {
    throw Error(`Unrecognized type: ${ JSON.stringify(a) }`)
  }
}

function substitute (sub, type) {
  if ( ! type ) return type

  if ( type.tag === 'Arrow' ) {
    return exports.Arrow(
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
  else if ( type.tag === 'Arrow' ) {
    return exports.Arrow(
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
