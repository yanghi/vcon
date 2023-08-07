export function isObject(obj: unknown): obj is Record<any, any> {
  return obj != null && typeof obj === 'object';
}

export const hasOwnProp = (obj: any, prop: string): boolean => {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};
export const hasProp = (obj: any, prop: string) => {
  return prop in obj;
};
