//
// This unification algorithm is the combination of two papers:
//   1. Primarily "Compositional Type Checking" by Dr. Gergö Éerdi, and
//   2. "Extensible records with scoped labels" by Daan Leijen for the record system.
//
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
    case 'RowTypeVar':
      var subst = t.Substitution(cs.left, cs.right)

      return [ subst ].concat(
        unify( env, constraints.map( c => t.substitute(subst, c) ) )
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

        var leftType  = left.compress()
        var rightType = right.compress()

        var extraRightLabels  = {}
        var extraLeftLabels = {}

        //
        // First create constraints for all left-side labels
        //
        for (var lab in leftType.labels) {

          if ( rightType.labels[lab] ) {
            newConstraints.push( t.Constraint( leftType.labels[lab], rightType.labels[lab] ) )
          }
          else {
            //
            // If the right-side record does not explicitly contain a label from the left,
            // then that label must exist & match within the right-side record's poly var.
            //
            // If the right-side record has no poly var (i.e. is concrete),
            // then it does not unify with the left.
            //
            if ( ! rightType.rowVars.length ) {
              // TODO: Use more specific error type
              throw new Errors.TypeError(env, left, right)
            }
            else if (rightType.rowVars.length >= 2) {
              throw new Error("You have more than one row type variable? (right)")
            }
            extraLeftLabels[lab] = leftType.labels[lab]
          }
          // .compress() returns a copy, so this is safe
          delete rightType.labels[lab]
        }

        //
        // Now fill in left poly constraints for the remaining right-side labels.
        // We also reuse `rightType.labels` to ensure we don't
        // double-iterate over labels from the left.
        //
        for (var lab in rightType.labels) {
          if ( ! leftType.rowVars.length ) {
            // TODO: Use more specific error type
            throw new Errors.TypeError(env, left, left)
          }
          else if (leftType.rowVars.length >= 2) {
            throw new Error("You have more than one row type variable? (left)")
          }
          extraRightLabels[lab] = rightType.labels[lab]
        }

        var leftExtraCount  = Object.keys(extraLeftLabels).length
        var rightExtraCount = Object.keys(extraRightLabels).length

        // If there is a row type variable, it must equal the extra labels.
        // If there isn't, then create a failing constraint (empty record).
        var leftRowVar  = leftType.rowVars[0] || toRecord({})
        var rightRowVar = rightType.rowVars[0] || toRecord({})

        if ( leftExtraCount > 0 && rightExtraCount === 0 ) {
          newConstraints.push( t.Constraint(rightRowVar, toRecord(extraLeftLabels)) )
        }
        else if ( leftExtraCount === 0 && rightExtraCount > 0 ) {
          newConstraints.push( t.Constraint(leftRowVar, toRecord(extraRightLabels)) )
        }
        else if ( leftExtraCount > 0 && rightExtraCount > 0 ) {

          // TODO: Check for recursive row types (somehow?)

          var unifyRowVar = t.RowTypeVar()
          newConstraints.push(
            t.Constraint( leftRowVar,  t.Record(null, [ unifyRowVar, t.RowSet(extraRightLabels) ]) ),
            t.Constraint( rightRowVar, t.Record(null, [ unifyRowVar, t.RowSet(extraLeftLabels) ]) )
          )
        }

        log("=> Pushing new constraints from Record:", inspect(newConstraints))
        pushAll(constraints, newConstraints)

        return unify(env, constraints)
      }

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

var log = function () {
  if (! process.env.DEBUG_TYPES) return
  console.log.apply(console, [].slice.call(arguments))
}

function pushAll (array, otherArray) {
  array.push.apply(array, otherArray)
  return array
}

var toRecord = (rows) => t.Record(null, [t.RowSet(rows)])

function inspect (obj) { return util.inspect(obj, { showHidden: false, depth: null }) }
