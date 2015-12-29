var _      = require('lodash')
var util   = require('util')

var t      = require('../types')
var Errors = require('./type-errors')


exports.unifyMonoEnvs = unifyMonoEnvs

exports.unifyTypes = (env, a, b) =>
  unify( env, [ t.Constraint(a, b) ] )

//
// [5.4] Unification of typings (p.32)
//
function unifyMonoEnvs (typeErrorHandler, env, monoEnvs, existingConstraints) {
  log("-=-=-\n[unifyMono]\n", monoEnvs)
  var varTypeMap = {}

  // Gather all variable usage, grouped by variable name
  monoEnvs.forEach(function(mEnv) {
    for (var varName in mEnv) {
      varTypeMap[varName] || (varTypeMap[varName] = [])
      varTypeMap[varName].push( mEnv[varName] )
    }
  })

  //
  // For each array of variable usages,
  // create a fresh type variable for all to agree on.
  //
  var constraints = _.flatten(
    Object.keys(varTypeMap).map(function(varName) {
      var usages = varTypeMap[varName]
      var freshTypeVar = t.TypeVar(null)
      return usages.map( u => t.Constraint( freshTypeVar, u ) )
    })
  )

  try {
    return unify( env, constraints.concat(existingConstraints || []) )
  }
  catch (err) {
    if (err instanceof Errors.TypeError) throw typeErrorHandler(err)
    else                                 throw err
  }
}

function unify (env, constraints) {
  if (constraints.length === 0) return []

  var cs = constraints.shift()
  var left = cs.left
  var right = cs.right
  if (right.tag === 'TypeVar' && left.tag !== 'TypeVar') {
    // To simplify the algorithm,
    // always ensure a present type variable is on the left side.
    var csSwapped = { left: cs.right, right: cs.left }
    cs = csSwapped
    left = csSwapped.left
    right = csSwapped.right
    log("[[[[Swapped]]]]")
  }

  log("\n\n----\nUnifying", inspect(left), "\nAnd\n", inspect(right))
  log("====Constraints====\n", inspect(constraints))

  switch (left.tag) {

    case 'TypeVar':
      return [ t.Substitution(cs.left, cs.right) ].concat(
        unify( env, substituteConstraints(cs, constraints) )
      )

    case 'Con':
      if (right.tag === 'Con') {
        var newConstraints =
          _.zip(left.args, right.args)
          .map( terms => t.Constraint(terms[0], terms[1]) )

        log("=> Pushing new constraints from Constructor:", inspect(newConstraints))
        pushAll(constraints, newConstraints)
        return unify(env, constraints)
      }

    case 'Arrow':

      if (right.tag === 'Arrow') {
        var newConstraints = [
          t.Constraint(left.range, right.range)
        ].concat(
          _.zip(left.domain, right.domain).map( terms => t.Constraint.apply(null, terms) )
        )
        log("=> Pushing new constraints from Arrow:", inspect(newConstraints))
        pushAll(constraints, newConstraints)
        return unify(env, constraints)
      }

    case 'Record':
      if (right.tag === 'Record') {

        var newConstraints = []

        var rightRowsCopy = Object.assign({}, right.rows)

        var leftPolyReqs  = {}
        var rightPolyReqs = {}

        //
        // First create constraints for all left-side labels
        //
        for (var label in left.rows) {
          if ( right.rows[label] ) {
            newConstraints.push( t.Constraint( left.rows[label], right.rows[label] ) )
          }
          else {
            //
            // If the right-side record does not explicitly contain a label from the left,
            // then that label must exist & match within the right-side record's poly var.
            //
            // If the right-side record has no poly var (i.e. is concrete),
            // then it does not unify with the left.
            //
            if ( ! right.polyTypeVar ) {
              throw new Errors.TypeError(env, left, right)
            }
            rightPolyReqs[label] = left.rows[label]
          }
          delete rightRowsCopy[label]
        }

        //
        // Then create constraints for the remaining right-side labels.
        // This is the same pattern as before, except we use `rightRowsCopy`
        // to ensure we don't double-iterate over labels from the left.
        //
        for (var label in rightRowsCopy) {
          if ( left.rows[label] ) {
            newConstraints.push( t.Constraint( right.rows[label], left.rows[label] ) )
          }
          else {
            if ( ! left.polyTypeVar ) {
              throw new Errors.TypeError(env, left, left)
            }
            leftPolyReqs[label] = right.rows[label]
          }
        }

        if ( left.polyTypeVar )  newConstraints.push( t.Constraint(left.polyTypeVar, leftPolyReqs) )
        if ( right.polyTypeVar ) newConstraints.push( t.Constraint(right.polyTypeVar, leftPolyReqs) )

        log("=> Pushing new constraints from Record:", inspect(newConstraints))
        pushAll(constraints, newConstraints)
        return unify(env, constraints)
      }
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS
      // LAST TIME: UNIFY RECORD AND UPDATE TEST HELPER TO REPLACE TYPE VARS WITH NAMED TYPE VARS, THEN REVERT freshTypeVar BACK TO THE WAY IT WAS

    case 'TermNum':
    case 'TermBool':
    case 'TermString':
    case 'TermUndefined':
      if (right.tag === left.tag) {
        log("Unified " + left.tag)
        return unify(env, constraints)
      }

    default:
      throw new Errors.TypeError(env, left, right)
  }

}

// Exported for testing
exports.substituteConstraints = substituteConstraints

function substituteConstraints (sub, constraints) {
  // TODO: occurs check
  log(`${sub.left.tag} ${sub.left._id || ''} = ${sub.right.tag} ${sub.right._id || ''}`)

  return constraints.map(function (c) {
    log("  [sub] checking against", c.left.tag, c.left._id || '', "=", c.right.tag, c.right._id || '')

    if (t.eq(c.left, sub.left)) {
      log("! [sub] Replacing", c.left, "with", sub.right)
      return t.Constraint(sub.right, c.right)
    }
    else if (t.eq(c.right, sub.left)) {
      log("!.[sub] Replacing", c.right, "with", sub.right)
      return t.Constraint(c.left, sub.right)
    }
    else if (c.right.tag === 'Arrow') {
      c.right.domain = c.right.domain.map(function(term) {
        log("  [sub][arrow] checking against", term.tag, term._id || '')
        if (t.eq(term, sub.left)) {
          log("! [sub][arrow] Replacing", term, "with", sub.right)
          return sub.right
        }
        else return term
      })
      var range = c.right.range
      log("  [sub][arrow] checking range against", range.tag, range._id || '')
      if (t.eq(range, sub.left)) {
        log("! [sub][arrow] Replacing range", range, "with", sub.right)
        c.right.range = sub.right
      }
      return c
    }
    else {
      // No substitutions to make.
      return c
    }
  })
}

function Row (record) {}

var log = function () {
  if (! process.env.DEBUG_TYPES) return
  console.log.apply(console, [].slice.call(arguments))
}

function pushAll (array, otherArray) {
  array.push.apply(array, otherArray)
  return array
}

function inspect (obj) { return util.inspect(obj, { showHidden: false, depth: null }) }
