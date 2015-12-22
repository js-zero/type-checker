require('./test-helper')

var glob = require('glob')

glob("./tests/*/**/*.js", { realpath: true }, function (err, files) {
  if (err) {
    return console.log("Could not glob test files:", err)
  }
  files.map(require)
})
