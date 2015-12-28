var test = require('tape')

test('Congruency', (assert) => {

  testInference(assert, `
    let wrapNum  = (x) => [x, 1]
    let wrapPoly = (x) => [x]
  `, {
    wrapNum:  `(Num) => Array(Num)`,
    wrapPoly: `(a) => Array(a)`
  })

  assert.end()
});
