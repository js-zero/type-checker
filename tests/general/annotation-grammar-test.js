var test = require('tape')

var t           = require(__src + '/types')
var compileType = require(__src + '/type-annotations').compile


test('Object annotations', (assert) => {

  var annotations = [
    compileType( `({ obj }) => { ...obj, x: Num }` ),
    compileType( `({ ...obj }) => { ...obj, x: Num }` )
  ]

  var rowTypeVar = t.RowTypeVar()
  var expectedType = t.Arrow(
    null,
    [ t.Record(null, {}, rowTypeVar) ],
    t.Record(null, { x: t.TermNum() }, rowTypeVar)
  )
  annotations.forEach( ann =>
    assert.ok( ann.match(expectedType) )
  )


  var invalidType = t.Arrow(
    null,
    [ t.Record(null, {}, t.RowTypeVar()) ],
    t.Record(null, { x: t.TermNum() }, t.RowTypeVar())
  )
  annotations.forEach( ann =>
    assert.notOk( ann.match(invalidType), "does not match against separate type variables" )
  )

  assert.end()
});
