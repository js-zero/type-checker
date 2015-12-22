var fs = require('fs')
var esprima = require('esprima')
var pretty = require('./src/pretty')

exports.typeCheckFile = function (file) {

  var source = fs.readFileSync(file, 'utf8')

  var ast = esprima.parse(source, {
    loc: true,
    source: 'subject.js',
    comment: true
  })

  var TypeChecker = require('./src/type-checker')
  var env = TypeChecker.typeCheck(ast)

  console.log("\nInferred the following:\n")
  console.log(pretty.env(env))
  console.log("No type errors found :)")
}
