var fs = require('fs')
var pretty = require('./pretty')

exports.report = function (env, typeErr) {

  var leftType  = typeErr.leftType
  var rightType = typeErr.rightType
  var leftNode  = typeErr.leftNode
  var rightNode = typeErr.rightNode

  var lpt = pretty.type(leftType)
  var rpt = pretty.type(rightType)

  var message = `
  However, your code has a type mismatch between \`${lpt}\` and \`${rpt}\`:

    You have ${ pretty.node(leftType.source, { article: true }) }
      with type \`${ lpt }\`
      at ${ lineNo(leftNode.loc) }
      located here:

    ${ fileSource(leftNode.loc) }
    ${ colPointer(leftNode.loc) }

    And you have ${ pretty.node(rightType.source, { article: true }) }
      with type \`${ rpt }\`
      at ${ lineNo(rightNode.loc) }
      located here:

    ${ fileSource(rightNode.loc) }
    ${ colPointer(rightNode.loc) }

  These two usages do not match; please adjust your code accordingly.
`

  console.log(message)
}

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
