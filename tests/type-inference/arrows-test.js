var test = require('tape')

test('Block Arrows', (assert) => {

  testInference(assert, `
    let f = (x) => {
      let sub = x + 1
      let result = sub
      return \`Result: \${result}\`
    }
  `, {
    f: `(Num) => String`
  })

  assert.end()
})

test('Block Arrows - Early Returns', (assert) => {

  testInference(assert, `
    let f = (x) => {
      return 5
      let result = x + 1
      return \`Result: \${result}\`
    }
  `, {
    f: `(a) => Num`
  })

  assert.end()
})

test('Block Arrows - Early Empty Return', (assert) => {

  testInference(assert, `
    let f = (x) => {
      return
      let result = x + 1
      return \`Result: \${result}\`
    }
  `, {
    f: `(a) => ()`
  })

  assert.end()
})

test('Block Arrows - Implicit undefined', (assert) => {

  testInference(assert, `
    let f = (x) => {
      let result = x + 1
    }
  `, {
    f: `(Num) => ()`
  })

  assert.end()
})
