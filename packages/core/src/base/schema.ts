import { hasOwnProp, isObject, typeOf } from '../utils';

export type PropertyType = 'object' | 'array' | 'string' | 'boolean' | 'number';

type SchemaObject = {
  [x: string]: SchemaValue;
};

type SchemaArray = Array<SchemaValue>;

type SchemaValue = string | number | boolean | SchemaArray | SchemaObject | null;

export interface JSONSchema extends VConSchemaExtend {
  type?: PropertyType | PropertyType[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
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

  if (schema.type == 'object' && !('additionalProperties' in schema)) {
    return {
      properties: schema as any,
    };
  }

  return schema;
}

function validateSchemaType(name: string, schema: JSONSchema, schemaValue: any): [PropertyType | void, Error | void] {
  if (!schema.type) return [undefined, undefined];

  const type = typeOf(schemaValue);
  if (typeof schema.type === 'string') {
    if (type != schema.type) {
      return [undefined, new Error(`Invalid type, ${name} must be a ${schema.type} type, got ${type}`)];
    }
  } else if (schema.type && !schema.type.includes(type as any)) {
    return [
      undefined,
      new Error(`Invalid type, ${name} must be one of the types ${schema.type.join(',')}, got ${type}`),
    ];
  }

  return [type as any, undefined];
}

function normalizeSchema(schema: JSONSchema) {
  if (!schema.type) {
    const types: PropertyType[] = [];
    if (schema.properties) {
      types.push('object');
    }
    if (schema.items) {
      types.push('array');
    }
    if (types.length) {
      schema.type = types;
    }

    if (schema.required?.length == 0) {
      // todo warn log
      delete schema.required;
    }
  }
}

const ROOT_OBJECT = '$ROOT';
function namePath(parent: string, current: string | number, isArray = false): string {
  if (!current) return parent;

  return parent + (isArray ? `[${current}]` : `.${current}`);
}

function walk(scheduler: SchemaScheduler, schema: JSONSchema, schemaValue: any, name: string) {
  normalizeSchema(schema);

  if (schemaValue === undefined) {
    if (hasOwnProp(schema, 'default')) {
      schemaValue = schema.default;
    }
  }

  const currentName = namePath(name, undefined);
  const [inspectType, typeErr] = validateSchemaType(currentName, schema, schemaValue);

  scheduler.error.add(typeErr);

  if (!inspectType) return;

  if (inspectType == 'object') {
    if (schema.required) {
      let missed = schema.required.filter((required) => !hasOwnProp(schemaValue, required));
      if (missed.length) {
        scheduler.error.add(
          new Error(`Missed required, object ${currentName} missed required properties: [${missed.join(',')}]`),
        );
      }
    }

    if (schema.properties) {
      for (let prop in schema.properties) {
        walk(scheduler, schema.properties[prop], schemaValue?.[prop], namePath(name, prop));
      }
    }
    if (schema.additionalProperties == false) {
      for (let key in schemaValue) {
        if (!hasOwnProp(schema.properties, key)) {
          scheduler.error.add(
            new Error(`No additionalProperties, object ${currentName} got additional properties "${key}"`),
          );
          continue;
        }
      }
    } else if (isObject(schema.additionalProperties)) {
      for (let key in schemaValue) {
        if (!hasOwnProp(schema.properties, key)) {
          // todo, walk with a flag that to sign this is additional properties
          walk(scheduler, schema.additionalProperties, schemaValue[key], namePath(name, key));
        }
      }
    }
  } else if (inspectType === 'array') {
    if (schema.items) {
      for (let i = 0; i < schemaValue.length; i++) {
        walk(scheduler, schema.items, schemaValue[i], namePath(name, i, true));
      }
    }
  }
}

interface SchemaScheduler {
  error: ErrorCollection;
}

class ErrorCollection {
  errors: Error[] = [];
  constructor(public strict = false) {}
  log() {
    if (this.errors.length) {
      console.log(`[Vcon Schema] got ${this.errors.length} errors:`);
      this.errors.forEach((e) => {
        console.log(e);
      });
    }
  }
  add(e: Error | void | undefined | Error[]) {
    if (e) {
      if (Array.isArray(e)) {
        this.errors.push(...e);
      } else {
        this.errors.push(e);
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

  walk(scheduler, normalizedRootSchema(schema), schemaValue, ROOT_OBJECT);

  scheduler.error.log();
}
