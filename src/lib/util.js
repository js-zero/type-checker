
module.exports = {
  extend: extend,
  flattenOneLevel: flattenOneLevel,
  pushAll: pushAll
}

var slice = [].slice
function extend (target) {
  var sources = slice.call(arguments, 1)
  for (var i=0; i < sources.length; i++) {
    for (var prop in sources[i]) {
      target[prop] = sources[i][prop]
    }
  }
  return target
}

function flattenOneLevel (array) {
  var results = []
  for (var i=0; i < array.length; i++) {
    var elem = array[i]
    if (elem instanceof Array) {
      for (var j=0; j < elem.length; j++) { results.push(elem[j]) }
    }
    else results.push(elem)
  }
  return results
}

function pushAll (array, otherArray) {
  array.push.apply(array, otherArray)
  return array
}
