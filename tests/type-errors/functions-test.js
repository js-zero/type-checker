var test = require('tape')

var t          = require(__src + '/types')
var Errors     = require(__src + '/type-checker/type-errors')
var typeCheck  = require(__src + '/type-checker').typeCheck


test('Parameter Mismatch', (assert) => {
  var ast = parseAST(' let f = (x) => x + 1; f("hi"); ')
  var result = typeCheck(ast)

  assert.ok(result.typeErrors.length === 1)

  var err = result.typeErrors[0]
  assert.ok( err instanceof Errors.CallTypeError )

  var expectedType = t.Arrow(null, [t.TermNum()], t.TermNum())
  assert.ok( err.calleeNode.name === 'f' )
  assert.ok( t.eq(err.calleeTyping.type, expectedType) )

  assert.ok( err.argTypings.length === 1 )
  assert.ok( err.argTypings[0].type.tag === 'TermString' )

  assert.ok( err.badArgIndex === 0 )

  assert.end()
});
