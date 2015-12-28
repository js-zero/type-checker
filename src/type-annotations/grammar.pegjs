{
  var t = require('../types')
  var ANNOTATION = t.ANNOTATION

  var pretty = require('../pretty')
  var Typing = require('../type-checker/typing.js')
  var typeVarNames = {}

  function getLast (arr) { return arr[arr.length-1] }
}

Start
  = __ type:Type __ { return type }

Type
  = Constructor
  / Term
  / TypeVar
  / Arrow
  / Record

Term
  = name:ProperIdentifier {
    var type = t['Term' + name]
    if ( ! type ) {
      if ( t['Con' + name] )
        throw new Error(`Type Constructor ${name} takes exactly #{type.length-1} type arguments.`)
      else
        throw new Error('Type does not exist: ' + name)
    }
    return type(ANNOTATION)
  }

TypeVar
  = name:Identifier {
    if ( ! typeVarNames[name] ) { typeVarNames[name] = t.NamedTypeVar(name) }
    return typeVarNames[name]
  }

Constructor
  = constructor:ProperIdentifier __ "(" __ first:Type __ rest:("," __ Type)* __ ")" {
    var typeParams = [first].concat(rest)

    var type = t['Con' + constructor]
    if ( ! type ) {
      throw new Error(`Type Constructor does not exist: ${constructor}`)
    }
    if ( type.length-1 === 0 && typeParams.length > 0 ) {
      throw new Error(`Type Constructor ${constructor} does not take any type arguments.`)
    }
    else if ( type.length-1 !== typeParams.length ) {
      throw new Error(`Type Constructor ${constructor} takes exactly ${ pretty.pluralize('type argument', type.length-1)}.`)
    }
    return type( ANNOTATION, ...typeParams )
  }

Arrow
  = "(" __ first:Type rest:(__ "," __ Type)* ")" __ "=>" __ range:Type {
    var domain = [first].concat( rest.map(getLast) )
    return t.Arrow(ANNOTATION, domain, range)
  }

Record
  = "{" __ "}" {
    return t.Record(ANNOTATION, {}, null)
  }
  / "{" __ "..." __ polyVar:Identifier __ "}" {
    return t.Record( ANNOTATION, {}, t.NamedRowTypeVar(polyVar) )
  }
  / "{" __ first:LabelTypingPair __ pairs:(__ "," __ LabelTypingPair)* __ polyVar:RecordPolyVar? __ "}" {
    var recordTyping = { [first[0]]: first[1] }

    for (var i=0; i < pairs.length; i++) {
      var pair = getLast(pairs[i])
      recordTyping[ pair[0] ] = pair[1]
    }
    return t.Record(ANNOTATION, recordTyping, polyVar && getLast(polyVar) || null)
  }

LabelTypingPair
  = label:(Identifier / ProperIdentifier) __ ":" __ type:Type {
    return [label, Typing({}, type)]
  }

RecordPolyVar
  = "..." __ polyVar:Identifier { return polyVar }

Identifier "Identifier"
  = first:[a-z_] rest:IdentifierPart* { return first + rest.join('') }
ProperIdentifier "Type"
  = first:[A-Z] rest:IdentifierPart* { return first + rest.join('') }
IdentifierPart
  = [a-zA-Z0-9_]

__
  = (WhiteSpace / LineTerminatorSequence / Comment)* { return; }

WhiteSpace "WhiteSpace"
  = "\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / Zs

LineTerminatorSequence "end of line"
  = "\n"
  / "\r\n"
  / "\r"
  / "\u2028"
  / "\u2029"

Comment "comment"
  = "//" (!LineTerminator SourceCharacter)*

Zs = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

LineTerminator = [\n\r\u2028\u2029]

SourceCharacter = .

