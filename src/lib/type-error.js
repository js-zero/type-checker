var util = require('util')

module.exports = function TypeError (env, leftType, rightType) {

  Error.captureStackTrace(this, this.constructor)
  this.name = 'TypeError'

  this.leftType = leftType
  this.rightType = rightType

  this.leftNode = leftType.source
  this.rightNode = rightType.source
}
util.inherits(module.exports, Error)
