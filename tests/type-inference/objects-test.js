var test = require('tape')

test('Instantiation', (assert) => {

  testInference(assert, `
    let Point = (x, y) => ({ x: x, y: y })
    let p = Point(10, 20)
  `, {
    Point: `(a, b) => { x: a, y: b }`,
    p: `{ x: Num, y: Num }`
  })

  assert.end()
});
