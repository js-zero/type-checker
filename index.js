var fs = require('fs')
var esprima = require('esprima')
var pretty = require('./src/pretty')

exports.typeCheckFile = function (file) {

  var source = fs.readFileSync(file, 'utf8')

  var ast = esprima.parse(source, {
    loc: true,
    source: file,
    comment: true
  })

  var TypeChecker = require('./src/type-checker')
  var env = TypeChecker.typeCheck(ast)

  if (env !== false) {
    console.log("\n  I have inferred the following types:\n")
    console.log(pretty.env(env))
    console.log("  No type errors were found in your code. Great job!\n")
  }

}
