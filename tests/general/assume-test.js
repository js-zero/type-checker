var test = require('tape')

test('Assume annotations', (assert) => {

  testInference(assert, `
    $assume \`f : (Array(Num)) => Num\`
    let f = (x) => "assumed!"
    let fnum = f([20])
  `, {
    f:    `(Array(Num)) => Num`,
    fnum: `Num`
  })

  assert.end()
});
