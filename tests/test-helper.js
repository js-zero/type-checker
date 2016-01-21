var esprima = require('esprima')


global.__src = __dirname + '/../src'

global.buildAST = function (sourceString) {
  return esprima.parse(sourceString, {
    loc: false,
    source: 'Test Source Code Snippet',
    comment: true
  })
}


var t           = require(__src + '/types')
var pretty      = require(__src + '/pretty')
var typeCheck   = require(__src + '/type-checker').typeCheck
var compileType = require(__src + '/type-annotations').compile


global.testInference = function (assert, source, annotations, useDefaultEnv) {
  var parentEnv = useDefaultEnv ? getRuntimeEnv() : null

  var result = typeCheck( parentEnv, buildAST(source) )
  assert.equal( result.typeErrors.length, 0, "No type errors should exist." )

  if (result.typeErrors.length) {
    console.log( "Type error:", inspect(result.typeErrors[0]) )
    throw result.typeErrors[0]
  }

  for (var varName in annotations) {
    var annotation = compileType( annotations[varName] )
    var actualType = result.env.lookupOrFail(varName).type

    if ( ! annotation.match(actualType) ) {
      assert.fail(
        `Type inference failed for ${varName}.
       Expected: ${annotations[varName]}
       Got: ${ pretty.type(actualType) }`
      )
    }
  }

  return result
}
var util = require('util')
global.inspect = function (obj) { return util.inspect(obj, { showHidden: false, depth: null }) }


var fs = require('fs')
var runtimeEnv = null
function getRuntimeEnv () {
  if ( ! runtimeEnv ) {
    var runtimeFile   = __dirname + '/../src/runtime.js'
    var runtimeSource = fs.readFileSync(runtimeFile, 'utf8')
    runtimeEnv        = typeCheck( null, buildAST(runtimeSource) ).env
  }
  return runtimeEnv
}
