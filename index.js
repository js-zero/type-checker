var fs = require('fs')
var esprima = require('esprima')

exports.typeCheckFile = function (file) {
  console.log("CHECKING file", file)

  var source = fs.readFileSync(file, 'utf8')

  var ast = esprima.parse(source, {
    loc: true,
    source: 'subject.js',
    comment: true
  })

  var TypeChecker = require('./src/type-checker')
  TypeChecker.typeCheck(ast)

  console.log("No type errors found :)")
}
