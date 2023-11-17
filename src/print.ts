import { getMeta } from "./meta"
import { Form } from "./types"

/** @public writes a form as string */
export function printForm(form: Form): string {
  switch (form.type) {
    case "List": return `(${form.children.map(printForm).join(' ')})`
    case "Map": return `{${form.children.map(printForm).join(' ')}}`
    case "Set": return `#{${form.children.map(printForm).join(' ')}}`
    case "Vector": return `[${form.children.map(printForm).join(' ')}]`
    case "Lambda": return `#(${form.children.map(printForm).join(' ')})`
    case "Var": return `#'${(form as any).sname}`
    case "Backtick": return `\`${form.children.map(printForm).join(' ')}`
    case "Unquote": return `~${form.children.map(printForm).join(' ')}`
    case "UnquoteSplicing": return `~@${form.children.map(printForm).join(' ')}`
    case "Deref": return `@${form.children.map(printForm).join(' ')}`
    case "Symbol":
    case "ParamName":
    case "Keyword":
    case "Number":
    case "String":
      return `${getMeta(form).text}`
  }
  return `#_(?? ${form.type} ${form.children.map(printForm)} ???)`
}