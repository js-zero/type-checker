var test = require('tape')

var types       = require(__src + '/types.js')
var typeCheck   = require(__src + '/type-checker.js').typeCheck
var Errors      = require(__src + '/lib/type-errors.js')


test('Incongruent array literal', (assert) => {

  var ast = parseAST(' [10, 20, "nope"] ')
  var result = typeCheck(ast)

  assert.ok(result.typeErrors.length === 1)

  var err = result.typeErrors[0]
  assert.ok( err instanceof Errors.ArrayLiteralTypeError )
  assert.ok( err.elemTypes.length === 3, "All element types should be included" )
  assert.ok( err.elemTypes[0].type.tag === 'TermNum' )
  assert.ok( err.elemTypes[1].type.tag === 'TermNum' )
  assert.ok( err.elemTypes[2].type.tag === 'TermString' )

  assert.end()
});
