
exports.type = prettyType
exports.node = prettyNode

function prettyType (type) {
  switch (type.tag) {
    case 'TermString':
      return 'String'
    case 'TermNum':
      return 'Number'

    case 'TermArrow':
      var params = type.domain.map(prettyType)
      return `(${ params.join(',') }) => ${ prettyType(type.range) }`

    default:
      console.log("Unknown type:", type)
      return `${type.tag}::${type._id}`
  }
}

function prettyNode (node) {
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') return `'${node.value}'`
      if (typeof node.value === 'number') return `${node.value}`
      return `literal ${node.value}`

    case 'Identifier':
      return `variable \`${node.name}\``

    case 'BinaryExpression':
      return `Expression with binary operator \`${node.operator}\``

    default:
      console.log("Unknown node:", node)
      return node.type
  }
}
