var util = require('util')
var pretty = require('./pretty')

exports.report = function (ast, env, typeErr) {
  console.log(typeErr.message)
}

exports.TypeError = function TypeError (env, leftType, rightType) {

  Error.captureStackTrace(this, this.constructor)
  this.name = 'TypeError'

  this.leftType = leftType
  this.rightType = rightType

  this.message = `
cannot unify \`${pretty.type(leftType)}\` and \`${pretty.type(rightType)}\`
    ${leftType.tag}: ${pretty.node(leftType.source)} at line ${leftType.source.loc.start.line} col ${leftType.source.loc.start.column+1}
    ${rightType.tag}: ${pretty.node(rightType.source)} at line ${rightType.source.loc.start.line} col ${rightType.source.loc.start.column+1}
`
}
util.inherits(exports.TypeError, Error)
