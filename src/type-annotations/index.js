var t = require('../types')
var parser = require('./grammar.js')

exports.compile = function (annotationStr) {
  // TODO: Better syntax error messages
  var annotation = Object.create(annotationMethods)
  annotation.type = parser.parse(annotationStr)
  return annotation
}

var annotationMethods = {
  match: function (otherType) {
    return t.eq( t.transform(transformers, {}, this.type), otherType )
  }
}

var transformers = {

  'TypeVar': function (cache, type) {
    if ( ! cache[type._id] ) {
      cache[type._id] = t.NamedTypeVar(type.name)
    }
    return cache[type._id]
  },

  'RowTypeVar': function (cache, type) {
    if ( ! cache[type._id] ) {
      cache[type._id] = t.NamedRowTypeVar(type.name)
    }
    return cache[type._id]
  }
}
