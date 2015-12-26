var test = require('tape')

var t         = require(__src + '/types')
var typeCheck = require(__src + '/type-checker').typeCheck
var Errors    = require(__src + '/type-checker/type-errors')
var Typing    = require(__src + '/type-checker/typing')


test('Incompatible objects', (assert) => {

  var ast = parseAST(`
    let o1  = { x: 1 }
    let o2  = { x: "2" }
    let arr = [o1, o2]
  `)
  var result = typeCheck(ast)

  assert.ok(result.typeErrors.length === 1)

  var err = result.typeErrors[0]
  assert.ok( err instanceof Errors.ArrayLiteralTypeError )
  assert.ok( err.elemTypings.length === 2, "All element types should be included" )

  var o1ExpectedType = t.Record(null, { x: Typing({}, t.TermNum()) })
  var o2ExpectedType = t.Record(null, { x: Typing({}, t.TermString()) })

  assert.ok( t.eq(err.elemTypings[0].type, o1ExpectedType) )
  assert.ok( t.eq(err.elemTypings[1].type, o2ExpectedType) )

  assert.end()
});
