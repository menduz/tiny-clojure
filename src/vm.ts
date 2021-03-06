import { IToken } from "ebnf"
import { Closure, CallableFunction } from "./closure"
import { NodeError } from "./types"
/**
 * @public
 */
export async function evaluate(node: IToken, closure: Closure): Promise<any> {
  try {
    // switch (true), I bet you've seen worse
    switch (true) {
      case node.type == "Document": {
        let lastResult = null
        for (let child of node.children) {
          lastResult = await evaluate(child, closure)
        }
        return lastResult
      }
      case node.type == "List" && node.children.length == 0: {
        throw new NodeError("Empty lists are not allowed", node)
      }
      case node.type == "List": {
        const fn: CallableFunction = await evaluate(node.children[0], closure)

        if (typeof fn != "function") {
          throw new NodeError(
            "The expression '" + node.children[0].text + "' does not resolve into a function: " + JSON.stringify(fn),
            node.children[0]
          )
        }

        return fn(node, node.children.slice(1), closure)
      }
      case node.type == "Vector": {
        const args: any[] = []

        for (let child of node.children) {
          args.push(await evaluate(child, closure))
        }

        return args
      }
      case node.type == "Map" && node.children.length % 2 == 1: {
        throw new NodeError("Invalid arity in map", node)
      }
      case node.type == "Map": {
        const ret = Object.create(null)
        for (let i = 0; i < node.children.length; i += 2) {
          const key = await evaluate(node.children[i], closure)
          if (typeof key != "symbol" && typeof key != "string") {
            throw new NodeError("Invalid map key", node.children[i])
          }
          ret[key] = await evaluate(node.children[i + 1], closure)
        }
        return ret
      }
      case node.type == "Set": {
        const args = new Set()

        for (let child of node.children) {
          args.add(await evaluate(child, closure))
        }

        return args
      }
      case node.type == "Keyword": {
        return Symbol.for(node.text)
      }
      case node.type == "HexLiteral": {
        return parseInt(node.text, 16)
      }
      case node.type == "String" || node.type == "Number" || node.type == "NegNumber": {
        return JSON.parse(node.text)
      }
      case node.type == "ParamName" || node.type == "Symbol": {
        const r = closure.get(node.text)
        if (r === undefined) {
          throw new NodeError(
            "Variable not set '" +
              node.text +
              "' variables in scope: " +
              Array.from(closure.variables.keys()).join(", "),
            node
          )
        }
        return r
      }
      case node.type == "Lambda": {
        return (async (_callerNode: IToken, argNodes: IToken[], callerClosure: Closure) => {
          const childClosure = closure.getChild()

          for (let i = 0; i < argNodes.length; i++) {
            childClosure.def(`%${i + 1}`, await evaluate(argNodes[i], callerClosure))
          }

          let lastResult = null
          for (let child of node.children) {
            lastResult = await evaluate(child, childClosure)
          }

          return lastResult
        }) as CallableFunction
      }
      default:
        throw new NodeError("Cannot evaluate node of type " + node.type, node)
    }
  } catch (e) {
    e.message = e.message + ".\n    at: " + node.text
    if (!e.node) {
      e.node = node
    }
    throw e
  }
}
