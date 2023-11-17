import { Var } from "./types"

/**
 * @public
 */
export class Closure {
  variables = new Map<string | symbol, Var>()

  constructor(public parentContext: Closure | null) { }

  def(name: string | symbol, value: any): Var {
    const v = new Var(name, undefined, value)
    this.variables.set(name, v)
    return v
  }

  getVar(name: string | symbol): Var | undefined {
    if (this.variables.has(name)) return this.variables.get(name)
    if (this.parentContext) return this.parentContext.getVar(name)
    return undefined
  }

  getChildClosure() {
    return new Closure(this)
  }
}
