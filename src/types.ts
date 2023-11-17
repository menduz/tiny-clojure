import type { Closure } from "./closure";
import { META_KEY, Meta } from "./meta";
import { printForm } from "./print";

export type CallableForm = (form: Form, env: Closure) => Promise<any> | any

export class Form<T extends string = string> {
  [META_KEY]: Meta = {}
  constructor(public type: T, public children: Form[] = []) { }
  toString() {
    return printForm(this)
  }
}

/// resolved VarQuote
export class Var extends Form<'Var'> {
  constructor(public sname: string | symbol, public ns?: string | symbol, public value?: any) { super('Var') }
  deref() {
    return this.value
  }
}

export class List extends Form<'List'> {
  constructor(children: Form[]) { super('List', children) }
}

/**
 * @public
 */
export class NodeError extends Error {
  constructor(message: string, public node: Form) {
    super(message)
  }
}