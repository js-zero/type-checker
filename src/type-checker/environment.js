//
// Environment.js
//
// Typings (as described in typing.js) only contain monomorphic types.
// Polymorphic types are contained within the "polymorphic environment"
// (or environment, for short).
// The environment (written as Γ) contains all known variables and their typings.
//
//     Γ = { f: Δ ⊢ t,  g: Δ2 ⊢ t2,  etc... }
//
// The polymorphic (Γ) environment is extended by variable and function **declarations**.
// The precense of variables **instantiates** members of the polymorphic environment,
// and adds these instantiations to the monomorphic (Δ) environment.
//
var Immutable = require('immutable')
var fail = require('./assert').fail


module.exports = Env

function Env (parent, typings) {
  var env = Object.create(methods)

  // parent allows an Env to walk up its scope chain
  env.parent = parent
  env.typings = {}

  return env
}


var methods = {}

methods.lookup = function (varName) {
  return this.typings[varName] ||
         this.parent && this.parent.lookup(varName) ||
         fail(`Variable \`${varName}\` not in scope.`)
}

methods.assign = function (varName, typing) {
  this.ensureUndefined(varName)
  this.typings[varName] = typing
  return this
}

methods.merge = function (env) {
  for (var varName in env.typings) {
    this.assign(varName, env.typings[varName])
  }
  return this
}

methods.ensureUndefined = function (varName) {
  return this.typings[varName] &&
         fail(`Variable \`${varName}\` is already defined.`)
}
