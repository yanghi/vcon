import { isObject, hasOwnProp } from '.';

export function _dotProp<T = Record<any, any>>(obj: T, prop: string | string[]) {
  let keys = typeof prop == 'string' ? prop.split('.') : prop;

  let cur: any = obj;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!isObject(cur) || !hasOwnProp(cur, key as string)) return [undefined, false];
    cur = cur[key as string];
  }
  return [cur, true];
}

export function dotProp<T = Record<any, any>>(obj: T, prop: string | string[]): { value: any; has: boolean } {
  if (!isObject(obj)) return { value: undefined, has: false };

  if (typeof prop == 'string' && hasOwnProp(obj, prop)) {
    return { value: obj[prop], has: true };
  }

  const [value, has] = _dotProp(obj, prop);

  return {
    value,
    has,
  };
}
