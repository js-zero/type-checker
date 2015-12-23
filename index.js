var fs      = require('fs')
var esprima = require('esprima')
var pretty  = require('./src/pretty')

exports.typeCheckFile = function (file) {

  var source = fs.readFileSync(file, 'utf8')

  var ast = esprima.parse(source, {
    loc: true,
    source: file,
    comment: true
  })

  var TypeChecker = require('./src/type-checker')
  var result = TypeChecker.typeCheck(ast)

  console.log("\n  I have inferred the following types:\n")
  console.log(pretty.env(result.env))

  if (result.typeErrors.length) {
    var ErrorReporter = require('./src/error-reporter')
    console.log(`\n  However, I found ${ pretty.pluralize('error', result.typeErrors.length) } in your code:`)
    console.log(
      result.typeErrors
        .map( err => ErrorReporter.report(result.env, err) )
        .join('\n-=-=-=-=--=-=-=-\n')
    )
  }
  else {
    console.log("\n  Your code has no type errors. Great job!\n")
  }

}
