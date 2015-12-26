var test = require('tape')

var types       = require(__src + '/types')
var typeCheck   = require(__src + '/type-checker').typeCheck
var Errors      = require(__src + '/type-checker/type-errors')


test('Incongruent array literal', (assert) => {

  var ast = parseAST(' [10, 20, "nope"] ')
  var result = typeCheck(ast)

  assert.ok(result.typeErrors.length === 1)

  var err = result.typeErrors[0]
  assert.ok( err instanceof Errors.ArrayLiteralTypeError )
  assert.ok( err.elemTypings.length === 3, "All element types should be included" )
  assert.ok( err.elemTypings[0].type.tag === 'TermNum' )
  assert.ok( err.elemTypings[1].type.tag === 'TermNum' )
  assert.ok( err.elemTypings[2].type.tag === 'TermString' )

  assert.end()
});
