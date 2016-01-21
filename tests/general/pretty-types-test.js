var test = require('tape')

var t      = require(__src + '/types')
var pretty = require(__src + '/pretty.js')


test('Pretty function types (with type variables)', (assert) => {

  // Create some irrelevant type vars first
  t.TypeVar(); t.TypeVar(); t.TypeVar()

  // Now create the ones we care about
  var a = t.TypeVar()
  var b = t.TypeVar()

  // More irrelevancy for good measure
  t.TypeVar(); t.TypeVar()


  var type = t.Arrow(null, [a, b], a)

  assert.equal( pretty.type(type), '(a, b) => a' )
  assert.end()
});


test('Pretty record types (with row type variables)', (assert) => {

  // Create some irrelevant type vars first
  t.RowTypeVar(); t.RowTypeVar(); t.RowTypeVar()

  // Now create the ones we care about
  var r = t.RowTypeVar()
  var s = t.RowTypeVar()

  // More irrelevancy for good measure
  t.RowTypeVar(); t.RowTypeVar()


  var type1 = t.Record(null, [
    r,
    t.RowSet({ x: t.TermNum(null), y: t.TermNum(null) }),
  ])
  assert.equal( pretty.type(type1, { isDomainType: true }), '{ x: Num, y: Num, ...r }' )

  var type2 = t.Record(null, [
    r,
    t.RowSet({ x: t.TermNum(null) }),
    s,
    t.RowSet({ y: t.TermNum(null) }),
  ])
  assert.equal( pretty.type(type2), '{ ...r, x: Num, ...s, y: Num }' )


  assert.end()
});


test('Pretty record types (within arrow types)', (assert) => {
  var r = t.RowTypeVar()
  var s = t.RowTypeVar()

  var domainRecord = t.Record(null, [r])

  var rangeRecord = t.Record(null, [
    s,
    t.RowSet({ x: t.TermNum(null) }),
    r,
    t.RowSet({ y: t.TermNum(null) }),
  ])

  var type = t.Arrow(null, [domainRecord], rangeRecord)

  assert.equal( pretty.type(type), '({ r }) => { ...s, x: Num, ...r, y: Num }' )

  assert.end()
})
