# JS Zero

*Current status: alpha prototype*

See the [aspiring docs](http://js-zero.com) for a vision of what JS Zero wants to be.

## Usage

```bash
$ npm install -g js-zero
$ jsz my-file.js
```

## Roadmap

- [x] Primitive types (Strings, Numbers, Functions)
- [x] Function calls
- [x] Arrays
- [x] Template strings
- [x] `$assume`
- [ ] Objects (records)
- [ ] Hoisted function definitions
- [ ] Mutually recursive functions
- [ ] Maps
- [ ] `$newtype`
- [ ] Tuple type
- [ ] Prototypes and keyword `this`
- [ ] First-class labels
- [ ] Spread/gather operators

## Type System

The JS Zero type system is based on Georgö Érdi's "Compositional Type Checking" MSc thesis. The big advantage to using this type system is twofold: **better errors**, and **"modular" typing**.

### Better Error Messages

First and foremost, the JS Zero type system gives you **better error messages**.

Let's illustrate the motivation for better errors using the example from the paper. Imagine you have the following two JavaScript functions:

```js
let toUpper = (str) => str.toUpperCase();
let not = (x) => !x;
```

And let's say - for the sake of example - you attempted to write the following function:

```js
function example (x) {
  toUpper(x); not(x);
}
```

Most type systems will give an error message that says `not(x)` is wrong because `x` is a string. This is assumed only because we used `x` as a string first via `toUpper(x)`.

However, both `toUpper(x)` and `not(x)` are well-typed **by themselves**. The type system should not be deciding which one is correct and which one isn't. It is better if the you are presented the conflict to decide for yourself. Such an error message might look like this:

```
Error: You are using a variable `x` in two conflicting ways.

Specifically:

  `toUpper(x)` treats `x` as having type: String

  and

  `not(x)` treats `x` as having type: Number

These two types are incompatible. Please adjust your code accordingly.
```

With JS Zero's type system, these types of error messages are possible.

### Modular Typing

Unlike many other popular language type systems, JS Zero's type system is **modular**. In practice this means that inferring one expression can be done independently of another expression. For example, take the following code:

```js
let myArray = [ foo(), bar(), baz() ]
```

How can the type checker know what kind of array this is? Four steps: it must infer the type of `foo()`, infer the type of `bar()`, infer the type of `baz()`, and then ensure their types all agree. However, because the type system is modular, it's possible to run these inferences **in parallel**, and also possible to **type check incrementally** i.e. when only a single function has changed.

### More Information

You can find out more information about Georgö Érdi's type system [here](http://gergo.erdi.hu/projects/tandoori/), or directly download the paper [here](http://gergo.erdi.hu/projects/tandoori/Tandoori-Compositional-Typeclass.pdf).

## Development

Make your changes, then run `npm test`. If you are making changes to the annotation grammar, you will want to run `npm run build; npm run test`.
