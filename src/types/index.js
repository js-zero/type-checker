var _         = require('lodash')
var t         = require('./definitions')
var transform = require('./transform')
var Record    = require('./records')

exports.eq = eq
exports.substitute   = substitute
exports.applySubs    = applySubs
exports.freshTypeVar = freshTypeVar

// Re-export type constructors
Object.assign(module.exports, t)

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
  else if (a.tag === 'Con') {
    return b.tag === 'Con'
        && _.chain(a.args).zip(b.args).all( pair => eq(pair[0], pair[1]) )
  }
  else if (a.tag === 'Arrow') {
    return b.tag === 'Arrow'
        && eq(a.range, b.range)
        && _.chain(a.domain).zip(b.domain).all( pair => eq(pair[0], pair[1]) )
  }
  else if (a.tag === 'Record') {
    return b.tag === 'Record' && Record.isEq(eq, a, b)
  }
  else {
    throw Error(`Unrecognized type: ${ JSON.stringify(a) }`)
  }
}

function substitute (sub, type) {
  return transform(substituteNodes, sub, type)
}

var attemptSub = (sub, type) =>
  eq(sub.left, type)
  ? Object.assign(sub.right, { source: type.source })
  : type

var substituteNodes = {
  'TypeVar': attemptSub,
  'RowTypeVar': attemptSub
}


function applySubs (substitutions, type) {
  return substitutions.reduce( (ty, sub, i) => substitute(sub, ty), type )
}


function freshTypeVar (cache, type) {
  return transform(freshTypeVarNodes, cache, type)
}

var freshTypeVarNodes = {

  'TypeVar': function (cache, type) {
    if ( ! cache[type._id] ) {
      cache[type._id] = t.TypeVar(type.source)
    }
    return cache[type._id]
  },

  'RowTypeVar': function (cache, type) {
    if ( ! cache[type._id] ) {
      cache[type._id] = t.RowTypeVar(type.source)
    }
    return cache[type._id]
  }
}
