//
// Plain-text error reporter
//
// If you would like to make something fancier,
// you should publish it as a separate package.
//
var _ = require('lodash')
var fs = require('fs')
var pretty = require('./pretty')

exports.report = function (env, typeErr) {
  return reporters[typeErr.name](env, typeErr)
}

var reporters = {}

reporters.TypeError = function (env, err) {
  var leftType  = typeErr.leftType
  var rightType = typeErr.rightType
  var leftNode  = typeErr.leftNode
  var rightNode = typeErr.rightNode

  var lpt = pretty.type(leftType)
  var rpt = pretty.type(rightType)

  return `
  Your code has a type mismatch between \`${lpt}\` and \`${rpt}\`:

    You have ${ pretty.node(leftType.source) }
      with type: \`${ lpt }\`
      at ${ lineNo(leftNode.loc) }
      located here:

    ${ fileSource(leftNode.loc) }
    ${ colPointer(leftNode.loc) }

    And you have ${ pretty.node(rightType.source) }
      with type: \`${ rpt }\`
      at ${ lineNo(rightNode.loc) }
      located here:

    ${ fileSource(rightNode.loc) }
    ${ colPointer(rightNode.loc) }

  These two usages do not match; please adjust your code accordingly.
`
}


reporters.CallTypeError = function (env, err) {
  var badArgNode = err.argNodes[err.badArgIndex]
  var badArgTyping = err.argTypings[err.badArgIndex]

  var together = `
      Together their types are: (${ err.argTypings.map( a => pretty.type(a.type) ) })`

  return `
  You are trying to call a function with an argument it cannot handle.

  Specifically:

    You are calling ${ pretty.node(err.calleeNode) }
      whose type is: ${ pretty.type(err.calleeTyping.type) }
      at ${ lineNo(err.calleeNode.loc) }
      located here:

    ${ fileSource(err.calleeNode.loc) }
    ${ colPointer(err.calleeNode.loc) }

    But the arguments' types are mismatched.${ err.argNodes.length >= 2 ? together : '' }
      Specifically, the ${ pretty.ordinalize(err.badArgIndex+1) } argument is mismatched
      with its type: ${ pretty.type(badArgTyping.type) }
      at ${ lineNo(badArgNode.loc) }
      located here:

    ${ fileSource(badArgNode.loc) }
    ${ colPointer(badArgNode.loc) }

  The arguments are incompatible with the function; please adjust your code accordingly.
`

}


reporters.ArrayLiteralTypeError = function (env, err) {

  var typingGroups = err.elemTypings.reduce(function (types, typing, i) {
    typing.source = err.node.elements[i]

    var key = pretty.type(typing.type)
    types[key] || (types[key] = [])
    types[key].push(typing)
    return types
  }, {})

  var groupCounter = 0

  var typingGroupDescriptions = _.chain(typingGroups)
    .map(function (typings, typeStr) {
      var first = typings[0]

      var then = (groupCounter > 0) ? 'then, ' : ''

      var others = (typings.length >= 2)
        ? `\n        ...and ${ pretty.pluralize('other', typings.length-1) } element of that type.`
        : ''

      groupCounter += 1
      return `
      ${ pretty.capitalize( then + pretty.node(first.source) ) }
        with type: ${ typeStr }
        at ${ lineNo(first.source.loc) }

        ${ fileSource(first.source.loc) }
        ${ colPointer(first.source.loc) }${others}`
    })
    .value()
    .join('\n\n')

  return `
  You have an array
    with elements of more than one type
    at ${ lineNo(err.node.loc) }

    Specifically, an array containing:\n${typingGroupDescriptions}

  All elements of an array must agree on a type;
  please adjust your code accordingly.
`
}

//
// Helpers
//
var fileCache = {}
function fileSource (loc) {
  var file = fileCache[loc.source] || fs.readFileSync(loc.source, 'utf8')
  return file.split('\n')[ loc.start.line-1 ]
}

function colPointer (loc) {
  var pointer = ''
  for (var i=0; i < loc.start.column; i++) {
    pointer += ' '
  }
  for (var i=loc.start.column; i < loc.end.column; i++) {
    pointer += '^'
  }
  return pointer
}

function lineNo (loc) {
  return `${loc.source}:${loc.start.line}:${loc.start.column+1}`
}

function hr (size) {
  var line = ''
  for (var i=0; i < size; i++) {
    line += '-'
  }
  return line
}
