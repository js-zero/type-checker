var u = require('./util')

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
      return `(${ params.join(', ') }) => ${ prettyType(type.range) }`

    case 'TermArray':
      return `Array[${ prettyType(type.elemType, options) }]`

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

    case 'ArrowFunctionExpression':
      return `${article ? 'a ' : ''}function`

    case 'CallExpression':
      return `${article ? 'a ' : ''}function call with ${ pluralize('argument', node.arguments.length) }`

    case 'BinaryExpression':
      return `An expression with binary operator \`${node.operator}\``

    case 'ArrayExpression':
      return `${article ? 'an ' : ''}array with ${ pluralize('hardcoded element', node.elements.length) }`

    default:
      console.log("Unknown node:", node)
      return node.type
  }
}

function prettyEnv (env) {
  var output = []
  for (var varName in env.typings) {
    var typing = env.typings[varName]
    var typingStr = `    ${varName}: ${ prettyType(typing.type) }`

    if (process.env.DEBUG_TYPES) {
      var monoEnv = typing.monoEnv
      if ( Object.keys(monoEnv).length ) {
        typingStr += "\n      with mono environment\n"
        typingStr += Object.keys(monoEnv).map(
          vname => `        ${vname}: ${ prettyType(monoEnv[vname]) }`
        ).join('\n')
      }
    }
    output.push(typingStr)
  }
  return output.join('\n')
}

function pluralize (word, count) {
  return `${count} ${word}${ count === 1 ? '' : 's'}`
}
