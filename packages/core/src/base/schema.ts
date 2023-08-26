import { duplicatesElements, hasOwnProp, isInteger, isObject, quoteValue, typeOf, uniqueArray } from '../utils';
import { TransformType, transform } from './transform';

export type PropertyType = 'object' | 'array' | 'string' | 'boolean' | 'number' | 'null' | 'integer' | 'any';

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

  maximum?: number | undefined;
  minimum?: number | undefined;
  maxLength?: number | undefined;
  minLength?: number | undefined;
  enum?: SchemaValue[] | undefined;
  maxItems?: number | undefined;
  minItems?: number | undefined;
  uniqueItems?: boolean | undefined;
  pattern?: string | undefined;
  anyOf?: JSONSchema[];
  not?: JSONSchema[];
}

export interface ValueSource {
  type?: ValueSourceName;
  key: string | string[];
}

type ValueSourceName = 'env' | 'command';

export interface VConSchemaExtend {
  // source?: ValueSourceName | ValueSource
  transform?: TransformType;
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
  if (!schema.type || schema.type == 'any') return ['any', undefined];

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

  const currentName = name;
  const addError = (msg: string) => {
    scheduler.error.add(name, new Error(msg));
  };

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
    let validateTypeRes = validateSchemaType(currentName, schema, schemaValue);

    if (validateTypeRes[1] && schema.transform) {
      const transformResult = transform({ value: schemaValue, type: schema.type }, schema.transform);

      if (transformResult.transformed) {
        validateTypeRes = validateSchemaType(name, schema, transformResult.value);

        if (!validateTypeRes[1]) {
          schemaValue = transformResult.value;
        }
      }
      scheduler.error.add(name, transformResult.errors);
    }

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
      const anyOfArr = schema.items.anyOf || [];

      const notArr = schema.not || [];

      for (let i = 0; i < schemaValue.length; i++) {
        const itemPath = namePath(name, i, true);
        walk(scheduler, schema.items, schemaValue[i], itemPath, (value) => {
          schemaValue[i] = value;
        });

        if (anyOfArr.length) {
          let anyOfExpected = false;

          for (let j = 0; j < anyOfArr.length; j++) {
            const anyOfSchema = anyOfArr[j];
            const anyOfErrorCollection = new ErrorCollection();

            walk({ error: anyOfErrorCollection }, anyOfSchema, schemaValue[i], itemPath, () => {});

            anyOfExpected = !anyOfErrorCollection.size;

            if (anyOfExpected) {
              break;
            }
          }

          if (!anyOfExpected) {
            scheduler.error.add(
              itemPath,
              new Error(`Must be valid against exactly one of the subschemas: \n${JSON.stringify(schema.items.anyOf)}`),
            );
          }
        }

        if (notArr.length > 0) {
          let expected = true;
          for (let j = 0; j < notArr.length; j++) {
            const notSchema = notArr[j];
            const errorCollection = new ErrorCollection();

            walk({ error: errorCollection }, notSchema, schemaValue, name, () => {});

            expected = errorCollection.size > 0;

            if (!expected) {
              break;
            }
          }

          if (!expected) {
            scheduler.error.add(
              name,
              new Error(`Value does not validate against "not" schema.: \n${JSON.stringify(schema.items.not)}`),
            );
          }
        }
      }
      if (schema.minItems && schemaValue.length < schema.minItems) {
        addError('There must be a minimum of ' + schema.minItems + ' in the array');
      }
      if (schema.maxItems && schemaValue.length > schema.maxItems) {
        addError('There must be a maximum of ' + schema.maxItems + ' in the array');
      }
      if (schema.uniqueItems) {
        const duplicates = duplicatesElements(schemaValue);

        if (duplicates.length) {
          addError(`Duplicates items, duplicated items: ${quoteValue(duplicates)}`);
        }
      }
    }
  } else {
    if (schema.maxLength && typeof schemaValue == 'string' && schemaValue.length > schema.maxLength) {
      addError(
        `Invalid characters length, may only be ${schema.maxLength}  characters long, got ${schemaValue.length}`,
      );
    }
    if (schema.minLength && typeof schemaValue == 'string' && schemaValue.length < schema.minLength) {
      addError(
        `Invalid characters length, must be at least ${schema.minLength} characters long, got ${schemaValue.length}`,
      );
    }
    if (
      typeof schema.minimum !== 'undefined' &&
      typeof schemaValue == typeof schema.minimum &&
      schema.minimum > schemaValue
    ) {
      addError(`Invalid range, must have a minimum value of ${schema.minimum}, got ${schemaValue}`);
    }
    if (
      typeof schema.maximum !== 'undefined' &&
      typeof schemaValue == typeof schema.maximum &&
      schema.maximum < schemaValue
    ) {
      addError(`Invalid range, must have a maximum value of ${schema.maximum}, got ${schemaValue}`);
    }

    if (schema.pattern && typeof schemaValue == 'string' && !schemaValue.match(schema.pattern)) {
      addError(`Pattern not match, string "${schemaValue}" not match the regex pattern ${schema.pattern}`);
    }

    if (schema.enum) {
      let matched = schema.enum.find((em) => em === schemaValue);
      if (!matched) {
        addError(`Invalid value, ${quoteValue(schemaValue)} not one of the enumeration ${schema.enum.join(',')}`);
      }
    }
  }

  if (inspectType !== 'array') {
    if (schema.anyOf) {
      const anyOfArr = schema.anyOf || [];

      if (anyOfArr.length) {
        let anyOfExpected = false;

        for (let j = 0; j < anyOfArr.length; j++) {
          const anyOfSchema = anyOfArr[j];
          const anyOfErrorCollection = new ErrorCollection();

          walk({ error: anyOfErrorCollection }, anyOfSchema, schemaValue, name, () => {});

          anyOfExpected = !anyOfErrorCollection.size;

          if (anyOfExpected) {
            break;
          }
        }

        if (!anyOfExpected) {
          scheduler.error.add(
            name,
            new Error(`Must be valid against exactly one of the subschemas: \n${JSON.stringify(schema.items.anyOf)}`),
          );
        }
      }
    }

    if (schema.not) {
      const notArr = schema.not;
      let expected = true;
      if (notArr.length > 0) {
        for (let j = 0; j < notArr.length; j++) {
          const notSchema = notArr[j];
          const errorCollection = new ErrorCollection();

          walk({ error: errorCollection }, notSchema, schemaValue, name, () => {});

          expected = errorCollection.size > 0;

          if (!expected) {
            break;
          }
        }

        if (!expected) {
          scheduler.error.add(
            name,
            new Error(`Value does not validate against "not" schema.: \n${JSON.stringify(schema.not)}`),
          );
        }
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
  values() {
    return this.errors.values();
  }
  get(name: string) {
    return this.errors.get(name);
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
