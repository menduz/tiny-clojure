import { IToken } from "ebnf";
/**
 * @public
 */
export class NodeError extends Error {
  constructor(message: string, public node: IToken) {
    super(message)
  }
}