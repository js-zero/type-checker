
module.exports = {
  extend: extend,
  flattenOneLevel: flattenOneLevel,
  pushAll: pushAll,
  objMap: objMap,
  objFilter: objFilter,
  findIndex: findIndex
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

function objMap (obj, fn) {
  var results = {}
  for (var key in obj) {
    results[key] = fn(obj[key], key)
  }
  return results
}

function objFilter (obj, fn) {
  var results = {}
  for (var key in obj) {
    if ( fn(obj[key], key) ) results[key] = obj[key]
  }
  return results
}

function findIndex (array, fn) {
  for (var i=0; i < array.length; i++) {
    if ( fn(array[i]) ) return i
  }
  return -1
}
