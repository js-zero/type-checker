var t = require('../types')
var parser = require('./grammar.js')

exports.compile = function (annotationStr) {
  // TODO: Better syntax error messages
  return parser.parse(annotationStr)
}
