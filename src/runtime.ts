import { evaluate } from "./vm"
import { Form, NodeError, List, CallableForm } from "./types"
import { Closure } from "./closure"
import lodashget from 'lodash.get'
import { Meta, getMeta, withMeta } from "./meta"

/** @public */
export function first(form: Form): Form | undefined {
  return form?.children[0]
}

/** @public */
export function second(form: Form): Form | undefined {
  return form?.children[1]
}

/** @public */
export function getSymbolText(form: Form): string | never {
  if (form.type !== "Symbol") throw new NodeError("The form is not a symbol", form)
  return getMeta(form).text!
}

/** @public */
export function lget(obj: any, sname: string | symbol) {
  if (obj instanceof Map) {
    return obj.get(sname)
  }
  return lodashget(obj, sname)
}

/**
 * @public 
 * functions decorated with :internal-form DO NOT materialize (evaluate) arguments
**/
export const SPECIAL_FORM = Symbol.for(":special-form")

function withSpecialFormMeta(value: CallableForm): CallableForm {
  return withMeta(value as any, { [SPECIAL_FORM]: true })
}

const specialForms: Record<string, any> = {
  if: withSpecialFormMeta(async function (form, env) {
    const [_, ...args] = form.children
    const cond = await evaluate(args[0], env)
    if (cond) return await evaluate(args[1], env)
    return args.length > 2 ? await evaluate(args[2], env) : null
  }),
  do: withSpecialFormMeta(async function (form, env) {
    const results = await materialize(form.children, env)
    return (results.length ? results[results.length - 1] : null) ?? null
  }),
  def: withSpecialFormMeta(async function (form, env) {
    // (def a) OK // (def a initexpr) OK // (def a "docstring" initexpr) TODO
    var symbolNode: Form | undefined = undefined
    var nameNode: Form | undefined = undefined
    var metaNode: Form | undefined = undefined
    var valueNode: Form | undefined = undefined

    const [_, ...args] = form.children

    if (args.length == 1) {
      nameNode = args[0]
    } else if (args.length == 2) {
      nameNode = args[0]
      valueNode = args[1]
    } else if (args.length > 2) {
      nameNode = args[0]
      // docstring = args[1]
      valueNode = args[2]
    }

    if (nameNode?.type == "Tag") {
      if (second(nameNode)?.type == "Symbol") {
        metaNode = first(nameNode)!
        symbolNode = second(nameNode)!
      }
    } else if (nameNode?.type == "Symbol") {
      symbolNode = nameNode
    }

    if (!symbolNode) throw new NodeError("You can only def using symbols", form)

    const meta: Meta = metaNode ? await evaluate(metaNode, env) : {}
    const value = valueNode ? await evaluate(valueNode, env) : undefined

    const name = getSymbolText(symbolNode)

    const v = env.def(name, value)

    return withMeta(v, meta)
  }),
  ".": withSpecialFormMeta(async function (form, env) {
    const [_dot, objNode, keyNode, ...argsNodes] = form.children
    let keyText = getSymbolText(keyNode)
    const isProperty = keyText.startsWith('-')
    if (isProperty) keyText = keyText.substring(1)
    const obj = await evaluate(objNode, env)
    const val = lget(obj, keyText) ?? lget(obj, Symbol.for(':' + keyText))

    if (isProperty) {
      return val ?? null
    } else {
      return applyToValues(form, val.bind(obj), env, await materialize(argsNodes, env))
    }
  }),
  fn: withSpecialFormMeta(async function (form, env) {
    const [_fnKeyword, ...rest] = form.children

    let fnName: Form | undefined = undefined

    if (rest[0].type == "Symbol") {
      fnName = rest.shift()
    }

    let parameterNames: string[] = []

    if (rest[0].type == "Vector") {
      const parameters = rest.shift()!
      for (const param of parameters.children) {
        parameterNames.push(getSymbolText(param))
      }
    } else {
      throw new NodeError("Expected parameters vector", rest[0])
    }

    const fnBody = rest.length > 1 ? Forms.doList(rest, getMeta(form)) : rest[0]

    const lambda = async (...args: any[]) => {
      // first hydrate parameters using invocation arguments
      const childClosure = env.getChildClosure()

      for (let i = 0; i < args.length; i++) {
        childClosure.def(parameterNames[i], args[i])
      }

      // then apply the function. fnNode must resolve to a callable function
      return await evaluate(fnBody, childClosure)
    }
    return lambda
  }),
  let: withSpecialFormMeta(async function (form, env) {
    const [_letKeyword, bindings, ...body] = form.children

    const childClosure = env.getChildClosure()

    if (bindings.type == "Vector") {
      for (let i = 0; i < bindings.children.length; i += 2) {
        const sname = bindings.children[i + 0];
        const value = bindings.children[i + 1];
        childClosure.def(getSymbolText(sname), await evaluate(value, childClosure))
      }
    } else {
      throw new NodeError("Expected parameters vector", bindings ?? form)
    }

    const fnBody = body.length > 1 ? Forms.doList(body, getMeta(form)) : body[0]

    return await evaluate(fnBody, childClosure)
  }),
}

const internal: Record<string, any> = {
  "vec": async (...args: any[]) => args,
  "set": async (...args: any[]) => new Set(args),
  "macro-var": withSpecialFormMeta(async (form, env) => env.getVar(getSymbolText(first(form)!))),
  "map": async function (...args: any[]) {
    if (args.length % 2 == 1) throw new Error("map received invalid number of arguments")

    const ret = new Map()

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i + 0]
      const value = args[i + 1]
      if (typeof key != "symbol" && typeof key != "string") {
        throw new Error(`Invalid map key: ${key}`)
      }
      ret.set(key, value)
    }

    return ret
  },
}

const core: Record<string, Function> = {
  "apply": withSpecialFormMeta(async function (form, env) {
    const [_applySymbol, fn, args] = await materialize(form.children, env)
    return applyToValues(form, fn, env, args)
  }),
  "var": withSpecialFormMeta(async (form, env) => env.getVar(getSymbolText(second(form)!))),
  "quote": withSpecialFormMeta(async (form) => second(form)),
  "get": async (key: any, value: any) => lget(key, value),
  "deref": async (arg: any) => {
    if (!('deref' in arg))
      throw new Error(`Value ${arg} does not implement deref`)
    return arg.deref()
  },
  "keyword": withSpecialFormMeta(async (form, env) => Symbol.for(getMeta(form).text!)),
  "str": async (...args: any[]) => args.join(''),
}

/**
 * @public
 */
export class BaseClosure extends Closure {
  constructor(lib: Record<string | symbol, Function> = {}) {
    super(null)
    for (const [name, value] of Object.entries(specialForms)) {
      this.def(name, value)
    }
    for (const [name, value] of Object.entries(core)) {
      this.def('core/' + name, value)
    }
    for (const [name, value] of Object.entries(internal)) {
      this.def('internal/' + name, value)
    }
    for (const [name, value] of Object.entries(lib)) {
      this.def(name, value)
    }

    this.def("nil", null)
    this.def("true", true)
    this.def("false", false)
  }

  defJsFunction(name: string | symbol, fn: Function) {
    this.def(name, fn)
  }
}

/** sequantially evaluates a list of forms and returns the seq @public */
export async function materialize(forms: Form[], env: Closure): Promise<any[]> {
  const materializedArgs: any[] = []
  for (let i = 0; i < forms.length; i++) {
    materializedArgs.push(await evaluate(forms[i], env))
  }
  return materializedArgs
}

/** calls a function using forms as arguments. It materializes them as needed @internal */
export async function applyToForms(form: Form, fn: Function, env: Closure, argsNodes: Form[]) {
  // fnNode must resolve to a callable function
  if (typeof fn != "function") throw new NodeError("The form does not resolve into a function", form)

  try {
    if ((getMeta(fn) as any)[SPECIAL_FORM])
      return (fn as CallableForm)(form, env)
    else
      return fn.apply(null, await materialize(argsNodes, env))
  } catch (e: any) {
    if (!e.node) e.node = form
    throw e
  }
}

/** calls a function using values @internal */
export async function applyToValues(form: Form, fn: Function, env: Closure, args: Form[]) {
  // fnNode must resolve to a callable function
  if (typeof fn != "function") throw new NodeError("The form does not resolve into a function", form)

  try {
    if ((getMeta(fn) as any)[SPECIAL_FORM])
      return (fn as CallableForm)(form, env)
    else
      return fn.apply(null, args)
  } catch (e: any) {
    if (!e.node) e.node = form
    throw e
  }
}

/** @public */
export namespace Forms {
  export const list = (children: Form[], meta?: Meta): List => withMeta(new List(children), meta)
  export const symbol = (sname: string, meta?: Meta): Form => withMeta(new Form('Symbol'), ({ ...meta, text: sname }))
  export const doList = (children: Form[], meta?: Meta): Form => withMeta(new Form('List', [Forms.DO, ...children]), meta)

  export const DOT = Forms.symbol('.')
  export const DO = Forms.symbol('do')
}
