var util = require('util')
var _    = require('lodash')
var t    = require('../types')

exports.TypeError = function TypeError (env, leftType, rightType) {

  Error.captureStackTrace(this, this.constructor)
  this.name = 'TypeError'

  this.leftType = leftType
  this.rightType = rightType

  this.leftNode = leftType.source
  this.rightNode = rightType.source
}
util.inherits(exports.TypeError, Error)


exports.CallTypeError = function CallTypeError (err, env, node, calleeTyping, argTypings) {

  Error.captureStackTrace(this, this.constructor)
  this.name = 'CallTypeError'
  this.node = node

  this.badArgIndex = _.findIndex(
    argTypings,
    a => t.eq(a.type, err.leftType) || t.eq(a.type, err.rightType)
  )

  this.calleeNode   = node.callee
  this.calleeTyping = calleeTyping

  this.argTypings = argTypings
  this.argNodes   = node.arguments
}
util.inherits(exports.CallTypeError, exports.TypeError)


exports.ArrayLiteralTypeError = function ArrayLiteralTypeError (err, env, node, elemTypes) {

  Error.captureStackTrace(this, this.constructor)
  this.name = 'ArrayLiteralTypeError'
  this.node = node
  this.elemTypes = elemTypes
}
util.inherits(exports.ArrayLiteralTypeError, exports.TypeError)
