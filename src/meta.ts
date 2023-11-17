import { Form } from "./types"

export type Meta = {
  text?: string;
  start?: number;
  end?: number;
} & Record<string, any>

export const META_KEY = Symbol.for(":meta")
export function getMeta<T>(value: T): Meta {
  if(typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return {}

  const m = (value as any)[META_KEY] || Object.create(null); 
  (value as any)[META_KEY] = m;
  return m;
}
export function withMeta<T extends Object | Function | Form>(value: T, meta?: Meta): T {
  Object.assign(getMeta(value), meta || {});
  return value
}