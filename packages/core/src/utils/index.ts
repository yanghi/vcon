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

export function uniqueArray<T>(value: T[]): T[] {
  return [...new Set(value)];
}
export function isInteger(value: unknown): boolean {
  return Number.isInteger(value);
}

export function quoteValue(value: any): string {
  if (typeof value == 'string') return `"${value}"`;

  if (typeof value == 'number') return value + '';

  if (!value && typeof value == 'object') return 'null';

  if (Array.isArray(value)) {
    return `[${value.map(quoteValue).join(',')}]`;
  }

  return value.toString();
}

export function duplicatesElements<T>(array: T[]): T[] {
  const result: T[] = [];
  const exits = new Set();
  for (let i = 0; i < array.length; i++) {
    const element = array[i];
    if (exits.has(element)) {
      result.push(element);
    } else {
      exits.add(element);
    }
  }
  return result;
}

export function withDot(str: string) {
  if (str[0] === '.') return str;
  return '.' + str;
}
