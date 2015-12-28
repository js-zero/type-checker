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
var typeCheck   = require(__src + '/type-checker').typeCheck
var compileType = require(__src + '/type-annotations').compile

global.testInference = function (assert, ast, annotations) {

  var result = typeCheck( parseAST(ast) )
  assert.equal( result.typeErrors.length, 0, "No type errors should exist." )

  for (var varName in annotations) {
    var expectedType = compileType( annotations[varName] )
    assert.ok(t.eq( result.env.lookup(varName).type, expectedType ))
  }

  return result
}
