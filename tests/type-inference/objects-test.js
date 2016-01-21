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


test('Property functions', (assert) => {

  testInference(assert, `
    let identity = (x) => x
    let obj = { num: (x) => identity(x) + 1 }
  `, {
    identity:  `(a) => a`,
    'obj':     `{ num: (Num) => Num }`,
  })

  testInference(assert, `
    let identity = (x) => x
    let obj1 = { id: identity }
    let obj2 = { num: (x) => identity(x) + 1 }
    let str  = obj1.id('hello')
  `, {
    identity: `(a) => a`,
    obj1:     `{ id:  (a) => a }`,
    obj2:     `{ num: (Num) => Num }`,
    str:      `String`
  })

  assert.end()
})


test('Nested objects & functions', (assert) => {

  testInference(assert, `
    let a = { num: (x) => x + 1 }
    let b = { inner: a }
    let result = b.inner.num(5)
  `, {
    a:      `{ num: (Num) => Num }`,
    b:      `{ inner: { num: (Num) => Num } }`,
    result: `Num`,
  })

  assert.end()
})


test('Adding properties', (assert) => {

  testInference(assert, `
    let a = { x: 10 }
    let b = Object.let(a, { y: 20, z: 30 })
  `, {
    b: `{ x: Num, y: Num, z: Num }`
  }, true)

  assert.end()
});


test('Object extension', (assert) => {

  testInference(assert, `
    let extend = (obj) => Object.let(obj, { x: 10 })
    let result = extend({ y: '20' })
  `, {
    extend: `({ r }) => { ...r, x: Num }`,
    result: `{ x: Num, y: String }`
  }, true)

  assert.end()
})


test('Advanced Object Type Inference', (assert) => {

  // Example code taken from: https://github.com/elm-lang/elm-compiler/issues/656
  testInference(assert, `
    let choose = (i, a, b) =>
      i > 0 ? a : b

    let test = (r, s) =>
      choose( 0, Object.let(r, { x: 1 }), Object.let(s, { y: true }) )
  `, {
    test: `({ y: Bool, ...r }, { x: Num, ...r }) => { ...r, x: Num, y: Bool }`
  }, true)

  assert.end()
});
