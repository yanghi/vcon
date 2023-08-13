import { hasOwnProp, isInteger, isObject, typeOf, uniqueArray } from '../utils';

export type PropertyType = 'object' | 'array' | 'string' | 'boolean' | 'number' | 'null' | 'integer';

type SchemaObject = {
  [x: string]: SchemaValue;
};

type SchemaArray = Array<SchemaValue>;

type SchemaValue = string | number | boolean | SchemaArray | SchemaObject | null;

export interface JSONSchema extends VConSchemaExtend {
  type?: PropertyType | PropertyType[];
  properties?: Record<string, JSONSchema>;
  required?: string[] | boolean;
  items?: JSONSchema;
  additionalProperties?: JSONSchema | boolean;
  default?: SchemaValue;
  title?: string;
  description?: string;
}

export interface ValueSource {
  type?: ValueSourceName;
  key: string | string[];
}

type ValueSourceName = 'env' | 'command';

export interface VConSchemaExtend {
  // source?: ValueSourceName | ValueSource
}

export type VconSchema = Record<string, JSONSchema> | JSONSchema;

function normalizedRootSchema(schema: VconSchema): JSONSchema {
  if (schema.items || schema.properties) return schema;

  if (!schema.type) {
    return {
      properties: schema as any,
    };
  }

  return schema;
}

function validateSchemaType(
  name: string,
  schema: JSONSchema,
  schemaValue: any,
): [PropertyType | undefined, Error | undefined] {
  if (!schema.type) return [undefined, undefined];

  let type = typeOf(schemaValue);
  if (typeof schema.type === 'string') {
    if (schema.type === 'integer' && isInteger(schemaValue)) {
      type = 'integer' as any;
    }
    if (type != schema.type) {
      return [undefined, new Error(`Invalid type, must be a ${schema.type} type, got ${type}`)];
    }
  } else if (schema.type && !schema.type.includes(type as any)) {
    return [undefined, new Error(`Invalid type, must be one of the types ${schema.type.join(',')}, got ${type}`)];
  }

  return [type as any, undefined];
}

function isValidType(type: string): type is PropertyType {
  return ['object', 'array', 'string', 'boolean', 'number'].includes(type);
}
function isValidValue(value: unknown): value is SchemaValue {
  return isValidType(typeOf(value));
}

function normalizeSchema(schema: JSONSchema) {
  if (!schema.type) {
    let types: PropertyType[] = [];
    if (schema.properties) {
      types.push('object');
    }
    if (schema.items) {
      types.push('array');
    }

    if (hasOwnProp(schema, 'default')) {
      let defautValueType = typeOf(schema.default);
      if (isValidType(defautValueType)) {
        types.push(defautValueType);
      } else {
        delete schema.default;
        console.warn(`Invalid default value type: ${defautValueType}`);
      }
    }
    if (types.length) {
      types = uniqueArray(types);
      schema.type = types.length == 1 ? types[0] : types;
    }
  }
  if (Array.isArray(schema.required) && schema.required.length == 0) {
    delete schema.required;
    console.warn(`object schema "required" field is empty arrays, has been ignored`);
  }
}

const ROOT_OBJECT = '$ROOT';
function namePath(parent: string, current: string | number, isArray = false): string {
  if (!current) return parent;

  return parent + (isArray ? `[${current}]` : `.${current}`);
}

function walk(
  scheduler: SchemaScheduler,
  schema: JSONSchema,
  schemaValue: any,
  name: string,
  onPass: (value: SchemaValue) => void,
) {
  normalizeSchema(schema);

  if (schemaValue === undefined) {
    if (hasOwnProp(schema, 'default')) {
      schemaValue = schema.default;
    }
  }

  const currentName = namePath(name, undefined);

  let inspectType: PropertyType | undefined;

  let checkType = true;
  if (schemaValue === undefined) {
    if (schema.required) {
      scheduler.error.add(name, new Error(`Missing required value`));
      return;
    } else {
      checkType = false;
    }
  }

  if (checkType) {
    const validateTypeRes = validateSchemaType(currentName, schema, schemaValue);

    scheduler.error.add(name, validateTypeRes[1]);
    inspectType = validateTypeRes[0];
  }

  if (!inspectType) return;

  onPass(schemaValue);

  if (inspectType == 'object') {
    if (Array.isArray(schema.required)) {
      let missed = schema.required.filter((required) => !hasOwnProp(schemaValue, required));
      if (missed.length) {
        scheduler.error.add(name, new Error(`Missing required properties, missing : [${missed.join(',')}]`));
      }
    }

    if (schema.properties) {
      for (let prop in schema.properties) {
        walk(scheduler, schema.properties[prop], schemaValue?.[prop], namePath(name, prop), (value) => {
          schemaValue[prop] = value;
        });
      }
    }
    if (schema.additionalProperties == false) {
      for (let key in schemaValue) {
        if (!hasOwnProp(schema.properties, key)) {
          scheduler.error.add(name, new Error(`No additional properties, got additional properties "${key}"`));
          continue;
        }
      }
    } else if (isObject(schema.additionalProperties)) {
      for (let key in schemaValue) {
        if (!hasOwnProp(schema.properties, key)) {
          // todo, walk with a flag that to sign this is additional properties
          walk(scheduler, schema.additionalProperties, schemaValue[key], namePath(name, key), (value) => {
            schemaValue[key] = value;
          });
        }
      }
    }
  } else if (inspectType === 'array') {
    if (schema.items && schemaValue) {
      for (let i = 0; i < schemaValue.length; i++) {
        walk(scheduler, schema.items, schemaValue[i], namePath(name, i, true), (value) => {
          schemaValue[i] = value;
        });
      }
    }
  }
}

interface SchemaScheduler {
  error: ErrorCollection;
}

class ErrorCollection {
  errors = new Map<string, Error[]>();
  constructor(public strict = false) {}
  private _size: number = 0;
  get size() {
    return this._size;
  }
  log() {
    if (this.errors.size) {
      console.log(`[Vcon Schema] got ${this._size} errors:`);
      this.errors.forEach((errors, key) => {
        console.log(`Got ${errors.length} errors on ${key}:`);
        for (let i = 0; i < errors.length; i++) {
          console.log('  ', errors[i].message);
        }
      });
    }
  }
  add(name: string, e: Error | void | undefined | Error[]) {
    if (e) {
      if (!this.errors.has(name)) {
        this.errors.set(name, []);
      }
      const group = this.errors.get(name);
      if (Array.isArray(e)) {
        group.push(...e);
        this._size += e.length;
      } else {
        group.push(e);
        this._size++;
      }
      if (this.strict) {
        this.log();
        if (global && global.process) {
          process.exit(1);
        }
      }
    }
  }
}

export function walkSchema(
  schema: VconSchema,
  schemaValue: SchemaValue,
  scheduleOptions: {
    errorStrict?: boolean;
  } = {},
) {
  const scheduler: SchemaScheduler = {
    error: new ErrorCollection(scheduleOptions.errorStrict),
  };

  walk(scheduler, normalizedRootSchema(schema), schemaValue, ROOT_OBJECT, (value) => {
    schemaValue = value;
  });

  scheduler.error.log();

  return {
    result: schemaValue,
  };
}
