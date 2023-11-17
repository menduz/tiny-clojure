import { BaseClosure, evaluate, parse, printForm } from "../src"
import { future } from "fp-future"
import { Form } from "../src/types"

const tests: Record<string, any> = {
  '(yield 1)': 1,
  '(yield nil)': null,
  // "(yield UnDeFinEEdd)": undefined,

  '(yield :joda)': Symbol.for(':joda'),
  '(yield #{1 2})': new Set([1, 2]),
  '(yield {:a 1})': new Map([[Symbol.for(':a'), 1]]),
  '(def x {:a 1}) (yield x)': new Map([[Symbol.for(':a'), 1]]),
  '(def x {"a" 1}) (yield x)': new Map([['a', 1]]),
  '(yield (core/get {"a" 123} "a"))': 123,
  '(def k :a) (yield (core/get {:a 123} k))': 123,
  '(def the-fn #(yield %)) (the-fn 1)': 1,
  '(def ^{:doc "holis"} val 1) (yield val)': 1,
  '(def ^{:doc "holis"} val "docstring" 1) (yield val)': 1,

  // lambdas
  '(def fun #(yield 1)) (fun)': 1,
  '(def fun #(yield %)) (fun 1)': 1,
  '(def fun #(yield %1)) (fun 1)': 1,
  '(def fun #(yield %2)) (fun 11 22)': 22,
  '(core/apply #(yield %2) [11 22])': 22,
  '(def fun (fn [a b] (yield b))) (core/apply fun [11 23])': 23,
  '(def args [11 24]) (core/apply #(yield %2) args)': 24,

  // lambdas + (. obj dot)
  '(def obj {:age 28, :greet #(core/str "Hi " %)})  (yield (. obj greet "Bob"))': 'Hi Bob',
  '(def obj {:age 28, :greet #(core/str "Hi " %)})  (yield (.greet obj "Bob"))': 'Hi Bob',
  '(def obj {:age 28, :greet #(core/str "Hi " %)})  (yield (. obj -age))': 28,
  '(def obj {:age 28, :greet #(core/str "Hi " %)})  (yield (.-age obj))': 28,

  '(yield (.toString 1))': "1",
  '(yield (.has #{:aKey} :aKey))': true,
  '(yield (.has #{} :aKey))': false,

  // ignore-next form #_
  '(yield [1 2 3 #_ 4 5])': [1, 2, 3, 5],
  '(yield #_ [1 2 3 #_ 4 5] 6)': 6,

  // if + boolean literals
  '(yield (if true 1 2))': 1,
  '(yield (if false 1 2))': 2,

  // print atoms and lists
  "(yield '(a thing))": '; => (a thing)',
  "(yield #'yield)": "; => #'yield",
  "(yield (core/var yield))": "; => #'yield",
  "(yield ':hola)": "; => :hola",
  "(yield '\"str\")": '; => "str"',
  "(yield '123)": '; => 123',
  "(yield '[1 3])": '; => [1 3]',
  "(yield '@b)": '; => @b',
  "(yield '{})": '; => {}',
  "(yield '{:a 1 :b 1})": '; => {:a 1 :b 1}',
  "(yield '#(a-thing (str %)))": '; => #(a-thing (str %))',
  "(yield '\`(let [and# ~x] (if and# (and ~@next) and#)))": '; => \`(let [and# ~x] (if and# (and ~@next) and#))',

  // functions
  //'(defn greet [name] (core/str "Hello, " name)) (yield (greet "bob"))': "Hello, bob",
  '(def greet (fn [name] (core/str "Hello, " name))) (yield (greet "bob"))': "Hello, bob",
  '(yield (core/quote (123)))': "; => (123)",
  '(yield \'(123))': "; => (123)",

  // var expansion
  "(def a 1) (def b (core/var a)) (yield [a @b])": [1, 1],
  "(def a 1) (def b #'a) (yield [a @b])": [1, 1],

  // let expression
  "(def a 999) (def c #'a) (let [a 1 b 2 c @c] (yield [a b c]))": [1, 2, 999],
}

// blackbox tests and expects a JS value
async function runTest(source: string, expectedResult: any) {
  const closure = new BaseClosure()
  const fut = future<any>()

  const { document, syntaxErrors } = parse(source)

  expect(syntaxErrors).toEqual([])

  closure.defJsFunction("yield", (val) => {
    fut.resolve(val)
  })

  await evaluate(document, closure)

  const given = await fut
  if (given instanceof Form)
    expect('; => ' + printForm(given)).toEqual(expectedResult)
  else
    expect(given).toEqual(expectedResult)
}

describe("unit", () => {
  it("smoke test", () => {
    expect(parse("(a 123)").syntaxErrors).toEqual([])
    expect(parse("-123").document.children[0].type).toEqual("NegNumber")
  })

  let count = 0
  for (const [source, value] of Object.entries(tests)) {
    count++
    it(`runs examples that output results #${count} '${source}'`, async () => {
      await runTest(source, value)
    })
  }
})
