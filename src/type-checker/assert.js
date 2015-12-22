
exports.assert = assert
exports.fail = fail


function assert (truth, message) {
  if (!truth && message) {
    var e = new Error("Assertion failed: Expected " + message)
    throw e
  }
  return truth
}

function fail (message) {
  var e = new Error(message)
  throw e
}
