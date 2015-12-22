var esprima = require('esprima')


global.__src = __dirname + '/../src'

global.parseAST = function (sourceString) {
  return esprima.parse(sourceString, {
    loc: false,
    source: 'Test Source Code Snippet',
    comment: true
  })
}
