var test = require('tape')

var t          = require(__src + '/types.js')
var Errors     = require(__src + '/lib/type-errors.js')
var typeCheck  = require(__src + '/type-checker.js').typeCheck


test('Parameter Mismatch', (assert) => {

  var ast = parseAST(' let f = (x) => x + 1; f("hi"); ')
  var result = typeCheck(ast)

  assert.ok(result.typeErrors.length === 1)

  var err = result.typeErrors[0]
  assert.ok( err instanceof Errors.CallTypeError )

  var expectedType = t.TermArrow(null, [t.TermNum()], t.TermNum())
  assert.ok( err.calleeNode.name === 'f' )
  assert.ok( t.eq(err.calleeTyping.type, expectedType) )

  assert.ok( err.argTypings.length === 1 )
  assert.ok( err.argTypings[0].type.tag === 'TermString' )

  assert.ok( err.badArgIndex === 0 )

  assert.end()
});
