var pretty = require('./pretty')

exports.report = function (ast, subjects) {
  var leftNode  = subjects.leftNode
  var leftType  = subjects.leftType
  var rightNode = subjects.rightNode
  var rightType = subjects.rightType

  throw new Error(`
cannot unify \`${pretty.type(leftType)}\` and \`${pretty.type(rightType)}\`
    ${leftType.tag}: ${pretty.node(leftNode)} at line ${leftNode.loc.start.line} col ${leftNode.loc.start.column+1}
    ${rightType.tag}: ${pretty.node(rightNode)} at line ${rightNode.loc.start.line} col ${rightNode.loc.start.column+1}
`)

}
