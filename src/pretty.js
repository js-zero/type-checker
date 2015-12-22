
exports.type = prettyType
exports.node = prettyNode
exports.env  = prettyEnv

function prettyType (type, options) {
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

function prettyNode (node, options) {
  var article = options && options.article

  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') return `${article ? 'a string ' : ''}'${node.value}'`
      if (typeof node.value === 'number') return `${article ? 'a number ' : ''}${node.value}`
      return `literal ${node.value}`

    case 'Identifier':
      return `${article ? 'a ' : ''}variable \`${node.name}\``

    case 'BinaryExpression':
      return `An expression with binary operator \`${node.operator}\``

    default:
      console.log("Unknown node:", node)
      return node.type
  }
}

function prettyEnv (env) {
  var output = ""
  for (var varName in env.typings) {
    var typing = env.typings[varName]
    output += `    ${ varName }: ${ prettyType(typing.type) }\n`
  }
  return output
}
