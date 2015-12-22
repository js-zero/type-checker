var test = require('tape')

var types        = require(__src + '/types.js')
var typeCheck    = require(__src + '/type-checker.js').typeCheck
var JszTypeError = require(__src + '/lib/type-error.js')


test('Parameter Mismatch', (assert) => {

  var ast = parseAST(' let f = (x) => x + 1; f("hi"); ')
  var result = typeCheck(ast)

  assert.ok(result.typeErrors.length === 1)

  var err = result.typeErrors[0]
  assert.ok( err instanceof JszTypeError )
  assert.ok( isVariable('x', err.leftNode) || isVariable('x', err.rightNode) )

  assert.end()

  function isVariable (varName, node) {
    return node.type === 'Identifier' && node.name === varName
  }
});

