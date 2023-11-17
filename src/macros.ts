import { Closure } from "./closure";
import { getMeta, withMeta } from "./meta";
import { Form, Var } from "./types";
import * as RT from "./runtime";

function macroExpand1(form: Form, env: Closure): Form {
  if (form.type == "VarQuote") {
    const sname = getMeta(RT.first(form)).text!
    return withMeta(new Var(sname, undefined, env.getVar(sname)), form)
  } else if (form.type == "List") {
    const [head, ...tail] = form.children
    if (head && head.type == "Symbol") {
      const sname = getMeta(head).text!
      const isMacro = false; // if the symbol is a macro
      if (isMacro) {
        // ...
      } else if (sname.charAt(0) == '.' && sname != '.') {
        // (.substring s 2 5) => (. s substring 2 5)
        let meth = RT.Forms.symbol(sname.substring(1));
        const [target, ...rest] = tail
        const ret = RT.Forms.list([RT.Forms.DOT, target, meth, ...rest], form);
        return ret
      }
    }
  }
  return form
}

/** @public expands the macros of a form */
export function macroExpand(form: Form, env: Closure): Form {
  const exf = macroExpand1(form, env);
  if (exf != form)
    return macroExpand(exf, env)
  return form;
}
