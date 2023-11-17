import { Closure, } from "./closure"
import { NodeError, Var, Form } from "./types"
import * as RT from "./runtime"
import { getMeta } from "./meta"
import { macroExpand } from "./macros"

/**
 * A map of node-names -> functions. eg "Quote"->"core/quote"
 */
const sugarSyntaxNodes: Record<string, string> = {
  VarQuote: "internal/macro-var",
  Deref: "core/deref",
  UnquoteSplicing: "core/unquote-splicing",
  Unquote: "core/unquote",
  Keyword: "core/keyword",
  Map: "internal/map",
  Set: "internal/set",
  Vector: "internal/vec",
  Document: "do",
}

/**
 * This function converts a form into a value. Using an env:Closure as execution context.
 * @public
 */
export async function evaluate(form: Form, env: Closure): Promise<any> {
  try {
    form = macroExpand(form, env)
    // switch (true), I bet you've seen worse
    switch (true) {
      case form.type == "Var": return (form as Var).value
      case form.type == "Quote": return RT.first(form)
      case form.type == "HexLiteral": return parseInt(getMeta(form).text!, 16)
      case form.type == "String" || form.type == "Number" || form.type == "NegNumber": return JSON.parse(getMeta(form).text!)
      case form.type == "ParamName" || form.type == "Symbol": return getSymbolValueOrFail(env, getMeta(form).text!, form);
      case form.type == "Lambda": {
        const [fnNode, ...argsNodes] = form.children.map($ => macroExpand($, env))

        const lambda = async (...args: any[]) => {
          // first hydrate parameters using invocation arguments
          const childClosure = env.getChildClosure()

          for (let i = 0; i < args.length; i++) {
            childClosure.def(`%${i + 1}`, args[i])

            if (i == 0)
              childClosure.def(`%`, args[i])
          }

          // then apply the function. fnNode must resolve to a callable function
          const fn = await evaluate(fnNode, env)
          return RT.applyToForms(form, fn, childClosure, argsNodes)
        }
        return lambda
      }
      case form.type == "List": {
        const [fnNode, ...argsNodes] = form.children.map($ => macroExpand($, env))
        const fn = await evaluate(fnNode, env)
        return RT.applyToForms(form, fn, env, argsNodes)
      }
      case form.type in sugarSyntaxNodes: {
        const fn = getSymbolValueOrFail(env, sugarSyntaxNodes[form.type], form)
        return RT.applyToForms(form, fn, env, form.children)
      }
      default: throw new NodeError("Cannot evaluate node of type " + form.type, form)
    }
  } catch (e: any) {
    e.message = e.message + ".\n    at: " + ((form ? getMeta(form).text : null) ?? "???")
    if (!e.node) {
      e.node = form
    }
    throw e
  }
}


function getSymbolValueOrFail(closure: Closure, name: string, node: Form): any {
  const r = closure.getVar(name)
  if (r === undefined) {
    throw new NodeError(
      "Variable not set '" +
      name +
      "' variables in scope: " +
      Array.from(closure.variables.keys()).join(", "),
      node
    )
  }
  return r.value
}