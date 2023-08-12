export function isObject(obj: unknown): obj is Record<any, any> {
  return obj != null && typeof obj === 'object';
}

export const hasOwnProp = (obj: any, prop: string): boolean => {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};
export const hasProp = (obj: any, prop: string) => {
  return prop in obj;
};
export type ValueType =
  | 'bigint'
  | 'symbol'
  | 'undefined'
  | 'function'
  | 'null'
  | 'object'
  | 'array'
  | 'string'
  | 'boolean'
  | 'number';

export function typeOf(value: any): ValueType {
  if (!value && typeof value == 'object') return 'null';

  if (Array.isArray(value)) return 'array';
  return typeof value;
}
