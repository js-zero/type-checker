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
