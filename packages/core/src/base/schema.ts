import { duplicatesElements, hasOwnProp, isInteger, isObject, quoteValue, typeOf, uniqueArray } from '../utils';
import { IError } from './error';
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
  anyOf?: JSONSchema[] | undefined;
  allOf?: JSONSchema[] | undefined;
  oneOf?: JSONSchema[] | undefined;
  not?: JSONSchema[] | undefined;
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

export type SchemaKeyword = keyof JSONSchema;

export interface SchemaError extends IError {
  keyword: SchemaKeyword;
  path: string;
  schema: JSONSchema;
  schemaPath: string;
  reasons?: IError[] | undefined;
}

function makeSchemaError(
  keyword: SchemaKeyword,
  message: string,
  path: string,
  schemaPath: string,
  schema: JSONSchema,
  reasons?: SchemaError['reasons'],
): SchemaError {
  return {
    message,
    path,
    keyword,
    schema,
    schemaPath,
    reasons,
  };
}

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

const SCHEMA_ROOT = '#';
function getchemaPath(parent, current: string | number) {
  return parent + '/' + current;
}

function walk(
  scheduler: SchemaScheduler,
  schema: JSONSchema,
  schemaValue: any,
  name: string,
  currentSchemaPath: string,
  onPass: (value: SchemaValue) => void,
) {
  normalizeSchema(schema);

  if (schemaValue === undefined) {
    if (hasOwnProp(schema, 'default')) {
      schemaValue = schema.default;
    }
  }

  const addError = (keyword: SchemaKeyword, msg: string, reasons?: SchemaError['reasons']) => {
    scheduler.error.add(
      name,
      makeSchemaError(keyword, msg, name, getchemaPath(currentSchemaPath, keyword), schema, reasons),
    );
  };

  const getNextSchemaPath = (next: string) => getchemaPath(currentSchemaPath, next);

  let inspectType: PropertyType | undefined;

  let checkType = true;
  if (schemaValue === undefined) {
    if (schema.required) {
      addError('required', `Missing required value`);
      return;
    } else {
      checkType = false;
    }
  }

  if (checkType) {
    let validateTypeRes = validateSchemaType(name, schema, schemaValue);

    if (validateTypeRes[1] && schema.transform) {
      const transformResult = transform({ value: schemaValue, type: schema.type }, schema.transform);

      if (transformResult.transformed) {
        validateTypeRes = validateSchemaType(name, schema, transformResult.value);

        if (!validateTypeRes[1]) {
          schemaValue = transformResult.value;
        }
      }
      transformResult.errors && addError('transform', `Transform error`, transformResult.errors);
    }

    validateTypeRes[1] && addError('type', `Type invalid: ${validateTypeRes[1].message}`);
    inspectType = validateTypeRes[0];
  }

  if (!inspectType) return;

  onPass(schemaValue);

  if (inspectType == 'object') {
    if (Array.isArray(schema.required)) {
      let missed = schema.required.filter((required) => !hasOwnProp(schemaValue, required));
      if (missed.length) {
        addError('required', `Missing required properties, missing : [${missed.join(',')}]`);
      }
    }

    if (schema.properties) {
      for (let prop in schema.properties) {
        walk(
          scheduler,
          schema.properties[prop],
          schemaValue?.[prop],
          namePath(name, prop),
          getNextSchemaPath('properties/' + prop),
          (value) => {
            schemaValue[prop] = value;
          },
        );
      }
    }
    if (schema.additionalProperties == false) {
      for (let key in schemaValue) {
        if (!hasOwnProp(schema.properties, key)) {
          addError('additionalProperties', `No additional properties, got additional properties "${key}"`);
          continue;
        }
      }
    } else if (isObject(schema.additionalProperties)) {
      for (let key in schemaValue) {
        if (!hasOwnProp(schema.properties, key)) {
          // todo, walk with a flag that to sign this is additional properties
          walk(
            scheduler,
            schema.additionalProperties,
            schemaValue[key],
            namePath(name, key),
            getNextSchemaPath('additionalProperties/' + key),
            (value) => {
              schemaValue[key] = value;
            },
          );
        }
      }
    }
  } else if (inspectType === 'array') {
    if (schema.items && schemaValue) {
      const anyOfArr = schema.items.anyOf || [];

      const notArr = schema.not || [];

      for (let i = 0; i < schemaValue.length; i++) {
        const itemPath = namePath(name, i, true);
        walk(scheduler, schema.items, schemaValue[i], itemPath, getNextSchemaPath('items'), (value) => {
          schemaValue[i] = value;
        });
      }
      if (schema.minItems && schemaValue.length < schema.minItems) {
        addError('minItems', 'There must be a minimum of ' + schema.minItems + ' in the array');
      }
      if (schema.maxItems && schemaValue.length > schema.maxItems) {
        addError('maxItems', 'There must be a maximum of ' + schema.maxItems + ' in the array');
      }
      if (schema.uniqueItems) {
        const duplicates = duplicatesElements(schemaValue);

        if (duplicates.length) {
          addError('uniqueItems', `Duplicates items, duplicated items: ${quoteValue(duplicates)}`);
        }
      }
    }
  } else {
    if (schema.maxLength && typeof schemaValue == 'string' && schemaValue.length > schema.maxLength) {
      addError(
        'maxLength',
        `Invalid characters length, may only be ${schema.maxLength}  characters long, got ${schemaValue.length}`,
      );
    }
    if (schema.minLength && typeof schemaValue == 'string' && schemaValue.length < schema.minLength) {
      addError(
        'minLength',
        `Invalid characters length, must be at least ${schema.minLength} characters long, got ${schemaValue.length}`,
      );
    }
    if (
      typeof schema.minimum !== 'undefined' &&
      typeof schemaValue == typeof schema.minimum &&
      schema.minimum > schemaValue
    ) {
      addError('minimum', `Invalid range, must have a minimum value of ${schema.minimum}, got ${schemaValue}`);
    }
    if (
      typeof schema.maximum !== 'undefined' &&
      typeof schemaValue == typeof schema.maximum &&
      schema.maximum < schemaValue
    ) {
      addError('maximum', `Invalid range, must have a maximum value of ${schema.maximum}, got ${schemaValue}`);
    }

    if (schema.pattern && typeof schemaValue == 'string' && !schemaValue.match(schema.pattern)) {
      addError('pattern', `Pattern not match, string "${schemaValue}" not match the regex pattern ${schema.pattern}`);
    }

    if (schema.enum) {
      let matched = schema.enum.find((em) => em === schemaValue);
      if (!matched) {
        addError(
          'enum',
          `Invalid value, ${quoteValue(schemaValue)} not one of the enumeration ${schema.enum.join(',')}`,
        );
      }
    }
  }

  if (inspectType !== 'array') {
    if (schema.anyOf) {
      const anyOfArr = schema.anyOf || [];

      if (anyOfArr.length) {
        let anyOfExpected = false;
        const childSchema = getNextSchemaPath('anyOf');

        for (let j = 0; j < anyOfArr.length; j++) {
          const anyOfSchema = anyOfArr[j];
          const anyOfErrorCollection = new ErrorCollection<SchemaError>();

          walk({ error: anyOfErrorCollection }, anyOfSchema, schemaValue, name, childSchema, () => {});

          anyOfExpected = !anyOfErrorCollection.size;

          if (anyOfExpected) {
            break;
          }
        }

        if (!anyOfExpected) {
          addError('anyOf', `The value must match at least one of the specified schemas.`);
        }
      }
    }

    if (schema.not) {
      const notArr = schema.not;
      let expected = true;
      const childSchema = getNextSchemaPath('not');

      if (notArr.length > 0) {
        for (let j = 0; j < notArr.length; j++) {
          const notSchema = notArr[j];
          const errorCollection = new ErrorCollection<SchemaError>();

          walk({ error: errorCollection }, notSchema, schemaValue, name, childSchema, () => {});

          expected = errorCollection.size > 0;

          if (!expected) {
            break;
          }
        }

        if (!expected) {
          addError('not', `The value must not match the specified schema.`);
        }
      }
    }

    const allOf = schema.allOf;
    if (Array.isArray(allOf) && allOf.length) {
      let expected = true;
      const childSchema = getNextSchemaPath('allOf');

      for (let j = 0; j < allOf.length; j++) {
        const schemaItem = allOf[j];
        const errorCollection = new ErrorCollection<SchemaError>();

        walk({ error: errorCollection }, schemaItem, schemaValue, name, childSchema, () => {});

        expected = errorCollection.size == 0;

        if (!expected) {
          break;
        }
      }

      if (!expected) {
        addError('allOf', `The value must match all of the specified schemas.`);
      }
    }

    const oneOf = schema.oneOf;
    if (Array.isArray(oneOf) && oneOf.length) {
      let expectedCount = 0;
      const childSchema = getNextSchemaPath('oneOf');

      for (let j = 0; j < oneOf.length; j++) {
        const schemaItem = oneOf[j];
        const errorCollection = new ErrorCollection<SchemaError>();

        walk({ error: errorCollection }, schemaItem, schemaValue, name, childSchema, () => {});

        if (!errorCollection.size) {
          expectedCount++;
        }

        if (expectedCount > 1) {
          break;
        }
      }

      if (expectedCount != 1) {
        addError('oneOf', `The value must match exactly one of the specified schemas.`);
      }
    }
  }
}

interface SchemaScheduler {
  error: ErrorCollection<SchemaError>;
}

interface ErrorCollectionOptions<E extends IError = Error> {
  strict?: boolean;
  log?(this: ErrorCollection<E>, error: ErrorCollection<E>['errors']): void;
}
class ErrorCollection<E extends IError = Error> {
  private errors = new Map<string, E[]>();
  constructor(public options: ErrorCollectionOptions<E> = {}) {}
  private _size: number = 0;
  get size() {
    return this._size;
  }
  log() {
    if (this.errors.size) {
      if (this.options.log) {
        return this.options.log.call(this, this.errors);
      }

      console.log(`[Vcon Schema] got ${this._size} errors:`);
      this.errors.forEach((errors, key) => {
        console.log(`Got ${errors.length} errors on ${key}:`);
        for (let i = 0; i < errors.length; i++) {
          console.log('  ', errors[i].message);
        }
      });
    }
  }
  add(name: string, e: E | void | undefined | E[]) {
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
      if (this.options.strict) {
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
  errorList() {
    let all: E[] = [];

    this.errors.forEach((arr) => {
      all = all.concat(arr);
    });

    return all;
  }
}

export function walkSchema(
  schema: VconSchema,
  schemaValue: SchemaValue,
  errorOptions: ErrorCollectionOptions<SchemaError> = {},
) {
  if (!errorOptions.log) {
    errorOptions.log = schemaErrorLog;
  }

  const scheduler: SchemaScheduler = {
    error: new ErrorCollection<SchemaError>(errorOptions),
  };

  walk(scheduler, normalizedRootSchema(schema), schemaValue, ROOT_OBJECT, SCHEMA_ROOT, (value) => {
    schemaValue = value;
  });

  return {
    result: schemaValue,
    scheduler,
  };
}

function red(str: string) {
  return `\x1B[31m${str}\x1B[39m`;
}
function cyan(str: string) {
  return `\x1B[36m${str}\x1B[39m`;
}

function errorLog(...args: any[]) {
  console.log(
    ...args.map((arg) => (typeof arg == 'string' ? (/^\x1B\[.+\x1B\[39m$/.test(arg) ? arg : red(arg)) : arg)),
  );
}

const schemaErrorLog: ErrorCollectionOptions<SchemaError>['log'] = function (errors) {
  errorLog(`[vcon schema] got ${this.size} errors:\n`);

  errors.forEach((errorArr, path) => {
    errorLog(`Got ${errorArr.length} errors on ${cyan(path)}:`);
    for (let i = 0; i < errorArr.length; i++) {
      errorLog(`  <${errorArr[i].keyword}> at ${cyan(errorArr[i].schemaPath)}`, `${errorArr[i].message}`);
    }
    console.log();
  });
};
