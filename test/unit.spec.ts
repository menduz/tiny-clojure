import { parse } from "../src"
import expect from "expect"

describe("unit", () => {
  it("smoke test", () => {
    expect(parse("(a 123)").syntaxErrors).toEqual([])
    expect(parse("-123").document.children[0].type).toEqual("NegNumber")
  })
})
