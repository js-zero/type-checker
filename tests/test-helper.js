var esprima = require('esprima')


global.__src = __dirname + '/../src'

global.parseAST = function (sourceString) {
  return esprima.parse(sourceString, {
    loc: false,
    source: 'Test Source Code Snippet',
    comment: true
  })
}


var t           = require(__src + '/types')
var pretty      = require(__src + '/pretty')
var Errors      = require(__src + '/type-checker/type-errors')
var typeCheck   = require(__src + '/type-checker').typeCheck
var unifyTypes  = require(__src + '/type-checker/unify').unifyTypes
var compileType = require(__src + '/type-annotations').compile


global.testInference = function (assert, ast, annotations) {

  var result = typeCheck( parseAST(ast) )
  assert.equal( result.typeErrors.length, 0, "No type errors should exist." )

  for (var varName in annotations) {
    var expectedType = compileType( annotations[varName] )
    var actualType   = result.env.lookupOrFail(varName).type

    try {
      unifyTypes( result.env, actualType, expectedType )
    }
    catch (err) {
      if (err instanceof Errors.TypeError) {
        assert.fail(
          `Type inference failed for ${varName}.
           Expected: ${annotations[varName]}
           Got: ${ pretty.type(actualType) }`
        )
      }
      else {
        throw err
      }
    }
  }

  return result
}
var util = require('util')
var inspect = function (obj) { return util.inspect(obj, { showHidden: false, depth: null }) }