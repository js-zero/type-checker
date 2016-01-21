var test = require('tape')

test('Basic Ternary', (assert) => {

  testInference(assert, `
    let result = true ? 0 : 1
  `, {
    result:  `Num`
  })

  assert.end()
});


test('Ternary Function', (assert) => {

  testInference(assert, `
    let choose = (i, a, b) => i > 0 ? a : b
  `, {
    choose: `(Num, a, a) => a`
  })

  assert.end()
});
