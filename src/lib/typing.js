var t = require('../types')
var objMap = require('./util').objMap
//
// Typings
//
// When the type checker encounters an expression,
// that expression creates constraints on its environment.
// For example, the expression `f(x, y)` creates the
// following constraints:
//
//    f       : (a, b) => r
//    x       : a
//    y       : b
//    f(x, y) : r
//
//    where a, b, and r are type variables.
//
// In the above example, f has type (a, b) => r,
// which means f takes two parameters of types a and b,
// then returns a value of type r.
// With this in mind, x and y must have the same type as their
// respective parameters, so x has type a, and y has type b.
// Altogether, calling f(x, y) gives us
// the "final" value of type of r.
//
// Each : line is a constraint. A **typing** captures these constraints.
// A typing is written as Δ ⊢ t, where Δ is the constraints, and t
// is the resulting type.
//
// Writing the above example in this way will give us:
//
//    { f: (a, b) => r,  x: a,  y: b }  ⊢  r
//
// The Δ constraints are collectively known as the "monomorphic environment".
// The monomorphic environment is extended by the **presence** of variables.
//
module.exports = Typing

function Typing (monoEnv, type) {
  var typing = Object.create(methods)

  typing.monoEnv = monoEnv || {}
  typing.type = type

  return typing
}

var methods = {}

// Basically makes a copy, with all type variables as fresh
methods.instantiate = function () {
  var cache = {}
  var fresh = (ty) => t.freshTypeVar(cache, ty)

  return Typing(
    objMap(this.monoEnv, fresh ),
    fresh( this.type )
  )
}
