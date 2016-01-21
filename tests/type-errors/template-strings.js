var test = require('tape')

var t          = require(__src + '/types')
var Errors     = require(__src + '/type-checker/type-errors')
var typeCheck  = require(__src + '/type-checker').typeCheck


test('String Template Parameter restrictions', (assert) => {
  var ast = buildAST(`
    let inc = (x) => x + 1
    let exclaim = (x) => \`\${inc(x)}!\`
    exclaim('nope')
  `)
  var result = typeCheck(null, ast)

  assert.ok(result.typeErrors.length === 1, "An error was correctly detected")

  var err = result.typeErrors[0]
  assert.ok( err instanceof Errors.CallTypeError )

  var expectedType = t.Arrow(null, [t.TermNum()], t.TermString())
  assert.equal( err.calleeNode.name, 'exclaim' )
  assert.ok( t.eq(err.calleeTyping.type, expectedType) )

  assert.ok( err.argTypings.length === 1 )
  assert.ok( err.argTypings[0].type.tag === 'TermString' )

  assert.ok( err.badArgIndex === 0 )

  assert.end()
});
