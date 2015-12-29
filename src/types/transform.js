var t = require('./definitions')
var _ = require('lodash')

module.exports = function transform (defs, ctx, type) {
  if ( ! type ) return type
  if (type.tag === 'Substitution') throw new Error(`wut ${JSON.stringify(type)}`)

  var handler = defs[type.tag] || noop
  var type_ = handler(ctx, type)

  if ( type_.tag === 'Con' ) {
    return type_.constructor(
      type_.source,
      ...type_.args.map( arg => transform(defs, ctx, arg) )
    )
  }
  else if ( type_.tag === 'Arrow' ) {
    return t.Arrow(
      type_.source,
      type_.domain.map( term => transform(defs, ctx, term) ),
      transform( defs, ctx, type_.range )
    )
  }
  else if ( type_.tag === 'Record' ) {
    return t.Record(
      type_.source,
      _.mapValues( type_.rows, ty => transform(defs, ctx, ty) ),
      transform( defs, ctx, type_.polyVar )
    )
  }
  else {
    return type_
  }
}

function noop (ctx, type) { return type }
