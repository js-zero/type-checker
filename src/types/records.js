var _ = require('lodash')
var assert = require('assert')
//
// Implementation based on Daan Leijen's "Extensible records with scoped labels" white paper
//
module.exports = Record

// Debugging
var includeSource = process.env.DEBUG_TYPES ? false : true

function Record (sourceNode, rows) {
  return Object.assign(Object.create(methods), {
    tag: 'Record',
    rows: rows,
    source: includeSource && sourceNode,
  })
}

var methods = {
  lookupLabelType: function (label) {
    for (var i=this.rows.length-1; i >= 0; i--) {
      var row = this.rows[i]
      if ( row.tag === 'RowSet' && row.labelTypes[label] ) {
        return row.labelTypes[label]
      }
      else if ( row.tag === 'RowTypeVar' ) {
        return row
      }
    }
    return null
  },

  lookupRowTypeVar: function (_id) {
    for (var i=this.rows.length-1; i >= 0; i--) {
      var row = this.rows[i]
      if ( row.tag === 'RowTypeVar' && row._id === _id ) return row
    }
    return null
  },

  compress: function () {
    // TODO: Cache (after transform optimization)
    var result = { labels: {}, rowVars: [] }

    for (var i=this.rows.length-1; i >= 0; i--) {
      var row = this.rows[i]
      if ( row.tag === 'RowSet' )
        for (var lab in row.labelTypes) {
          if ( ! result.labels[lab] ) result.labels[lab] = row.labelTypes[lab]
        }
      else
        result.rowVars.push(row)
    }
    return result
  }
}

Record.RowSet = function (labelTypes) {
  return { tag: 'RowSet', labelTypes: labelTypes }
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

function recordEq (eq, recA, recB) {

  var aType = recA.compress()
  var bType = recB.compress()

  //
  // Ensure row type vars are equal
  //
  if ( aType.rowVars.length !== bType.rowVars.length ) return false

  var allMatch = _.all(
    aType.rowVars,
    (aVar) => _.any(bType.rowVars, (bVar) => eq(aVar, bVar) )
  )
  if ( ! allMatch ) return false

  //
  // Ensure all label types in record a match those of record b
  //
  for (var lab in aType.labels ) {
    var a = aType.labels[lab]
    var b = bType.labels[lab]

    if ( ! b || ! eq(a, b) ) return false
  }

  //
  // Ensure there are no extra labels in record b
  //
  for (var lab in bType.labels ) {
    if ( ! aType.labels[lab] ) return false
  }

  return true
}

//
// Warning: This function is destructive!
//
Record.optimizeRows = function (rows) {
  for (var i=rows.length-1; i >= 1; i--) {
    var current = rows[i]
    var next    = rows[i-1]
    if (current.tag === 'RowSet' && next.tag === 'RowSet') {
      // Replace both with a single set
      var newSet = Record.RowSet( Object.assign({}, next.labelTypes, current.labelTypes) )
      rows.splice( i-1, 2, newSet )
    }
  }
  return rows
}
