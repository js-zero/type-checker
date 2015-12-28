var _ = require('lodash')
var assert = require('assert')
//
// Implementation based on Daan Leijen's "Extensible records with scoped labels" white paper
//
module.exports = Record

// Debugging
var includeSource = process.env.HIDE_SOURCE_NODES ? false : true

function Record (sourceNode, rows, polyTypeVar) {
  return {
    tag: 'Record',
    rows: rows,
    polyTypeVar: polyTypeVar || null,
    source: includeSource && sourceNode,
  }
}

// Type variables for rows are treated separately from normal type variables
var varIdCounter = 95000;
Record.RowTypeVar = function (sourceNode) {
  varIdCounter += 1
  return { tag: 'RowTypeVar', source: includeSource && sourceNode, _id: varIdCounter }
}

Record.NamedRowTypeVar = function (name) {
  varIdCounter += 1
  return { tag: 'RowTypeVar', name: name, _id: null }
}

Record.freshTypeVars = function (recurse, cache, record) {
  return _.mapValues(record.rows, recurse)
}
Record.isEq = recordEq

function recordEq (eq, a, b) {

  // The records should not both be polymorphic
  if ( a.polyTypeVar && b.polyTypeVar ) {
    throw new Error(`Both records are polymorphic (how did this happen?)
      a: ${JSON.stringify(a)}
      b: ${JSON.stringify(b)}
    `)
  }

  // To simplify, ensure a present polymorphic record is on the right
  if ( a.polyTypeVar ) {
    var swap = a; a = b; b = swap;
  }

  var aLabels = Object.keys(a.rows)
  var bLabels = Object.keys(b.rows)

  if ( b.polyTypeVar ) {
    //
    // Easy optimization:
    // A record cannot be a subset of a polymorphic record if
    // the record requires fewer labels than the polymorphic record.
    //
    // Example: { x: 1, y: 2 } is a subtype of { x: 1, ...r }
    // However, { x: 1, y: 2 } is NOT a subtype of { x: 1, y: 2, z: 3, ...r }
    //
    if (aLabels.length < bLabels.length) return false
  }
  else {
    //
    // Easy optimization:
    // Since both records must be exactly the same,
    // if the number of labels do not match, exit early.
    //
    if (aLabels.length !== bLabels.length) return false
  }

  assert.ok( bLabels.length <= aLabels.length )

  //
  // At this point we can finally compare row types.
  //
  for (var i=0; i < aLabels.length; i++) {
    var isEq = eq(
      a.rows[ aLabels[i] ].type,
      b.rows[ bLabels[i] ].type
    )
    if ( ! isEq ) return false
  }
  return true
}
