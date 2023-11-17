import { BaseClosure, parse } from "../src"
import { macroExpand } from "../src/macros"

const macroExpandTests: Record<string, any> = {
  '(yield 1)': '(yield 1)',
  '(.obj t)': '(. t obj)',
  '(def a 1) #\'a': '(def a 1) #\'a',
  '(.substring s 2 5)': '(. s substring 2 5)',
  //'(defn a [arg] (+ arg 1))': '(def a (fn [arg] (+ arg 1)))',
}

async function runTest(form: string, expectedForm: any) {
  const closure = new BaseClosure()

  const { document, syntaxErrors } = parse(form)

  expect(syntaxErrors).toEqual([])
  expect(document.children.map($ => macroExpand($, closure).toString()).join(' ')).toEqual(expectedForm)
}

describe("macroexpand", () => {
  let count = 0
  for (const [source, value] of Object.entries(macroExpandTests)) {
    count++
    it(`#${count} '${source}'`, async () => {
      await runTest(source, value)
    })
  }
})
