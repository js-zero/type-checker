
exports.type = prettyType
exports.node = prettyNode
exports.env  = prettyEnv
exports.pluralize  = pluralize
exports.capitalize = capitalize
exports.ordinalize = ordinalize

function prettyType (type, options) {
  switch (type.tag) {
    case 'TermString':
      return 'String'
    case 'TermNum':
      return 'Number'

    case 'TermArrow':
      options || (options = {})
      options.typeVars || (options.typeVars = {})
      var params = type.domain.map( ty => prettyType(ty, options) )
      return `(${ params.join(', ') }) => ${ prettyType(type.range) }`

    case 'TermArray':
      return `Array[${ prettyType(type.elemType, options) }]`

    case 'TypeVar':
      options || (options = {})
      options.typeVars || (options.typeVars = {})
      options.typeVars[ type._id ] = alphabet[ Object.keys(options.typeVars).length ]
      return options.typeVars[ type._id ]

    default:
      console.log("Unknown type:", type)
      return `${type.tag}::${type._id}`
  }
}

function prettyNode (node) {
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') return `a string "${node.value}"`
      if (typeof node.value === 'number') return `a number ${node.value}`
      return `a literal? ${node.value}`

    case 'Identifier':
      return `a variable \`${node.name}\``

    case 'ArrowFunctionExpression':
      return `a function`

    case 'CallExpression':
      return `a value returned by a function call`

    case 'BinaryExpression':
      return `an expression with binary operator \`${node.operator}\``

    case 'ArrayExpression':
      return `an array with ${ pluralize('hardcoded element', node.elements.length) }`

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

function capitalize (str) {
  return str[0].toUpperCase() + str.substring(1)
}

// https://gist.github.com/jlbruno/1535691
function ordinalize (n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+(s[(v-20)%10]||s[v]||s[0]);
}

var alphabet = 'abcdefghijklmnopqrstuvwxyz'
