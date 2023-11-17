import { IRule, Grammars, Parser, IToken } from "ebnf"
import { grammar } from "./grammar"
import { walk } from "./walker"
import { Form } from "./types"
import { withMeta } from "./meta"

const RULES: IRule[] = Grammars.Custom.getRules(grammar)

/**
 * Creates a parser using the rules of the grammar
 * @public
 */
export const internalParser = new Parser(RULES, {})

/**
 * @public
 */
export type ParseResult = {
  document: Form
  syntaxErrors: IToken[]
}

/**
 * @public
 */
export function parse(code: string): ParseResult {
  const syntaxErrors: IToken[] = []
  const parsedDocument = internalParser.getAST(code + "\n", RULES[0].name)

  walk(parsedDocument, (node) => {
    // discard nodes
    node.children = node.children.filter(($) => $.type != "Discard" && $.type != "Comment")

    if (node.type == "SyntaxError" || node.type == "RestSyntaxError") {
      node.type = "SyntaxError"
      syntaxErrors.push(node)
      return false // do not walk deeper into the tree
    }
  })

  if (parsedDocument.rest.length) syntaxErrors.push({
    type: "SyntaxError",
    end: code.length - 1,
    start: code.length - parsedDocument.rest.length - 1,
    children: [],
    errors: [],
    text: parsedDocument.rest,
    fullText: parsedDocument.rest,
    parent: parsedDocument,
    rest: '',
  })

  const document = convertRecursive(parsedDocument)

  return { document, syntaxErrors }
}

/** Converts the AST into an Form tree */
function convertRecursive(token: IToken): Form {
  const children = token.children.map(convertRecursive)
  const ret = withMeta(new Form(token.type), {
    end: token.end,
    start: token.start,
    text: token.text
  })
  ret.children = children
  return ret
}
