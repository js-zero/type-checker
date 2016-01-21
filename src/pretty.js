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
  options.rowTypeVars || (options.rowTypeVars = {})
  options.typeVars || (options.typeVars = {})

  var markType = options.markType || _.identity

  switch (type.tag) {
    case 'TermString':
      return markType('String')
    case 'TermNum':
      return markType('Num')
    case 'TermBool':
      return markType('Bool')


    case 'Arrow':
      var domainStr = type.domain.map(
        ty => prettyType( ty, Object.assign({}, options, { isDomainType: true }) )
      ).join(', ')

      var rangeStr = prettyType( type.range, Object.assign({}, options, { isRangeType: true }) )

      return `(${ domainStr }) => ${ rangeStr }`


    case 'Con':
      var typeStr = markType(type.name)
      var subtypes = type.args.map( a => prettyType(a, options) )
      return `${ typeStr }(${ subtypes.join(', ') })`


    case 'TypeVar':
      if ( ! options.typeVars[ type._id ] ) {
        options.typeVars[ type._id ] = alphabet[ Object.keys(options.typeVars).length ]
      }
      var letterName = options.typeVars[ type._id ] +
        (process.env.DEBUG_TYPES
                ? `.${type.tag.replace('TypeVar', '')}${type._id-5000}`
                : '')
      return (options.markTypeVar || _.identity)( letterName )


    case 'RowTypeVar':
      if ( ! options.rowTypeVars[ type._id ] ) {
        options.rowTypeVars[ type._id ] = alphabet[ Object.keys(options.rowTypeVars).length + 17 ]
      }
      var letterName = options.rowTypeVars[ type._id ] +
        (process.env.DEBUG_TYPES
                ? `.${type.tag.replace('TypeVar', '')}${type._id-95000}`
               : '')

      return (options.markTypeVar || _.identity)( `...${letterName}` )


    case 'Record':
      var rows = _.map( type.rows, row => prettyType(row, options) )
      if ( options.isDomainType ) {
        rows.reverse()
      }
      if ( options.isDomainType && rows.length === 1 ) {
        // Change `{ ...r }` to `{ r }` for brevity
        rows[0] = rows[0].replace('...', '')
      }
      return `{ ${rows.join(', ')} }`


    case 'RowSet':
      var pairs = _.map( type.labelTypes, (type, label) => `${label}: ${prettyType(type, options)}` )
      return pairs.sort().join(', ')


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

    case 'ObjectExpression':
      return `an object literal with ${ pluralize('property', node.properties.length) }`

    case 'MemberExpression':
      return `a object property`

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
  if ( word[word.length-1] === 'y')
    return `${count} ${ count === 1 ? word : word.substring(0, word.length-1) + 'ies'}`
  else
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
