var _ = require('lodash')
var chalk  = require('chalk')

exports.node = prettyNode

exports.type  = prettyType
exports.typeC = prettyTypeColors

exports.env  = prettyEnv
exports.envC = prettyEnvColors

exports.pluralize  = pluralize
exports.capitalize = capitalize
exports.ordinalize = ordinalize

var defaultColorOptions = {
  markType:    str => chalk.blue(str),
  markTypeVar: str => chalk.magenta(str),
}

function prettyType (type, options) {
  options || (options = {})
  var markType = options.markType || _.identity

  switch (type.tag) {
    case 'TermString':
      return markType('String')
    case 'TermNum':
      return markType('Number')

    case 'TermArrow':
      options.typeVars || (options.typeVars = {})
      var domainStr = type.domain.map( ty => prettyType(ty, options) ).join(', ')
      return `(${ domainStr }) => ${ prettyType(type.range, options) }`

    case 'TermArray':
      var typeStr = markType('Array')
      var subtypeStr = prettyType(type.elemType, options)
      return `${ typeStr }[${ subtypeStr }]`

    case 'TypeVar':
      options.typeVars || (options.typeVars = {})
      if ( ! options.typeVars[ type._id ] ) {
        options.typeVars[ type._id ] = alphabet[ Object.keys(options.typeVars).length ]
      }
      return (options.markTypeVar || _.identity)( options.typeVars[ type._id ] )

    default:
      console.log("Unknown type:", type)
      return `${type.tag}::${type._id}`
  }
}

function prettyTypeColors (type, options) {
  return prettyType(type, Object.assign(options || {}, defaultColorOptions))
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

function prettyEnv (env, options) {
  var output = []
  for (var varName in env.typings) {
    var typing = env.typings[varName]
    var typingStr = `    ${varName}: ${ prettyType(typing.type, options) }`

    if (process.env.DEBUG_TYPES) {
      var monoEnv = typing.monoEnv
      if ( Object.keys(monoEnv).length ) {
        typingStr += "\n      with mono environment\n"
        typingStr += Object.keys(monoEnv).map(
          vname => `        ${vname}: ${ prettyType(monoEnv[vname], options) }`
        ).join('\n')
      }
    }
    output.push(typingStr)
  }
  return output.join('\n')
}

function prettyEnvColors (env) {
  return prettyEnv(env, Object.assign({}, defaultColorOptions))
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
