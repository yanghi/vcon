import { duplicatesElements, hasOwnProp, isInteger, isObject, quoteValue, typeOf, uniqueArray } from '../utils';
import { IError } from './error';
import { SyncBailHook } from './hook/SyncBailHook';
import { TransformType, transform } from './transform';
import { ErrorCollection, ErrorCollectionOptions } from './ErrorCollection';

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
  value: any,
): [PropertyType | undefined, Error | undefined] {
  if (!schema.type || schema.type == 'any') return ['any', undefined];

  let type = typeOf(value);
  if (typeof schema.type === 'string') {
    if (schema.type === 'integer' && isInteger(value)) {
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

type Paths = {
  schemaPath: string;
  schemaName: string | number | undefined;
  propertyName: string | number | undefined;
  propertyPath: string;
};

class SchemaMetas {
  public readonly originValue: any;
  constructor(
    public readonly schema: JSONSchema,
    public readonly schemaPath: string,
    public readonly schemaName: string | number | undefined,
    public value: any,
    public readonly propertyPath: string,
    public readonly propertyName: string | number | undefined,
  ) {
    this.originValue = value;
  }
}

function walk(scheduler: SchemaScheduler, metas: SchemaMetas, onPass: (value: SchemaValue) => void) {
  normalizeSchema(metas.schema);

  let { value, schema } = metas;

  if (value === undefined) {
    if (hasOwnProp(schema, 'default')) {
      value = schema.default;
    }
  }

  const parsedValue = scheduler.hooks.parseValue.call(null, value, metas);

  if (parsedValue !== undefined) {
    value = metas.value = parsedValue;
  }

  const addError = (keyword: SchemaKeyword, msg: string, reasons?: SchemaError['reasons']) => {
    scheduler.error.add(
      metas.propertyPath,
      makeSchemaError(keyword, msg, metas.propertyPath, getchemaPath(metas.schemaPath, keyword), schema, reasons),
    );
  };

  const getNextSchemaPath = (next: string) => getchemaPath(metas.schemaPath, next);

  let inspectType: PropertyType | undefined;

  let checkType = true;
  if (value === undefined) {
    if (schema.required) {
      addError('required', `Missing required value`);
      return;
    } else {
      checkType = false;
    }
  }

  if (checkType) {
    let validateTypeRes = validateSchemaType(metas.schemaPath, schema, value);

    if (validateTypeRes[1] && schema.transform) {
      const transformResult = transform({ value: value, type: schema.type }, schema.transform);

      if (transformResult.transformed) {
        validateTypeRes = validateSchemaType(metas.schemaPath, schema, transformResult.value);

        if (!validateTypeRes[1]) {
          value = transformResult.value;
        }
      }
      transformResult.errors && addError('transform', `Transform error`, transformResult.errors);
    }

    validateTypeRes[1] && addError('type', `Type invalid: ${validateTypeRes[1].message}`);
    inspectType = validateTypeRes[0];
  }

  if (!inspectType) return;

  onPass(value);

  if (inspectType == 'object') {
    if (Array.isArray(schema.required)) {
      let missed = schema.required.filter((required) => !hasOwnProp(value, required));
      if (missed.length) {
        addError('required', `Missing required properties, missing : [${missed.join(',')}]`);
      }
    }

    if (schema.properties) {
      for (let prop in schema.properties) {
        walk(
          scheduler,
          new SchemaMetas(
            schema.properties[prop],
            getNextSchemaPath('properties/' + prop),
            prop,
            value?.[prop],
            namePath(metas.propertyPath, prop),
            prop,
          ),
          (_value) => {
            value[prop] = _value;
          },
        );
      }
    }
    if (schema.additionalProperties == false) {
      for (let key in value) {
        if (!hasOwnProp(schema.properties, key)) {
          addError('additionalProperties', `No additional properties, got additional properties "${key}"`);
          continue;
        }
      }
    } else if (isObject(schema.additionalProperties)) {
      for (let key in value) {
        if (!hasOwnProp(schema.properties, key)) {
          // todo, walk with a flag that to sign this is additional properties
          walk(
            scheduler,
            new SchemaMetas(
              schema.additionalProperties,
              getNextSchemaPath('additionalProperties/' + key),
              key,
              value[key],
              namePath(metas.propertyPath, key),
              key,
            ),
            (_value) => {
              value[key] = _value;
            },
          );
        }
      }
    }
  } else if (inspectType === 'array') {
    if (schema.items && value) {
      for (let i = 0; i < value.length; i++) {
        const itemPath = namePath(metas.propertyPath, i, true);
        walk(
          scheduler,
          new SchemaMetas(schema.items, getNextSchemaPath('items'), 'items', value[i], itemPath, i),
          (_value) => {
            value[i] = _value;
          },
        );
      }
      if (schema.minItems && value.length < schema.minItems) {
        addError('minItems', 'There must be a minimum of ' + schema.minItems + ' in the array');
      }
      if (schema.maxItems && value.length > schema.maxItems) {
        addError('maxItems', 'There must be a maximum of ' + schema.maxItems + ' in the array');
      }
      if (schema.uniqueItems) {
        const duplicates = duplicatesElements(value);

        if (duplicates.length) {
          addError('uniqueItems', `Duplicates items, duplicated items: ${quoteValue(duplicates)}`);
        }
      }
    }
  } else {
    if (schema.maxLength && typeof value == 'string' && value.length > schema.maxLength) {
      addError(
        'maxLength',
        `Invalid characters length, may only be ${schema.maxLength}  characters long, got ${value.length}`,
      );
    }
    if (schema.minLength && typeof value == 'string' && value.length < schema.minLength) {
      addError(
        'minLength',
        `Invalid characters length, must be at least ${schema.minLength} characters long, got ${value.length}`,
      );
    }
    if (typeof schema.minimum !== 'undefined' && typeof value == typeof schema.minimum && schema.minimum > value) {
      addError('minimum', `Invalid range, must have a minimum value of ${schema.minimum}, got ${value}`);
    }
    if (typeof schema.maximum !== 'undefined' && typeof value == typeof schema.maximum && schema.maximum < value) {
      addError('maximum', `Invalid range, must have a maximum value of ${schema.maximum}, got ${value}`);
    }

    if (schema.pattern && typeof value == 'string' && !value.match(schema.pattern)) {
      addError('pattern', `Pattern not match, string "${value}" not match the regex pattern ${schema.pattern}`);
    }

    if (schema.enum) {
      let matched = schema.enum.find((em) => em === value);
      if (!matched) {
        addError('enum', `Invalid value, ${quoteValue(value)} not one of the enumeration ${schema.enum.join(',')}`);
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

          walk(
            { ...scheduler, error: anyOfErrorCollection },
            new SchemaMetas(anyOfSchema, childSchema, j, value, metas.propertyPath, metas.propertyName),
            () => {},
          );

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

          walk(
            { ...scheduler, error: errorCollection },
            new SchemaMetas(notSchema, childSchema, j, value, metas.propertyPath, metas.propertyName),
            () => {},
          );

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

        walk(
          { ...scheduler, error: errorCollection },
          new SchemaMetas(schemaItem, childSchema, metas.schemaPath, value, metas.propertyPath, metas.propertyName),
          () => {},
        );

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

        walk(
          { ...scheduler, error: errorCollection, hooks: scheduler.hooks },
          new SchemaMetas(schemaItem, childSchema, j, value, metas.propertyPath, metas.propertyName),
          () => {},
        );

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

export type ParseSchemaValueHook = SyncBailHook<(result: any, metas: SchemaMetas) => any>;

export interface SchemaHooks {
  parseValue: ParseSchemaValueHook;
}

export interface SchemaScheduler {
  error: ErrorCollection<SchemaError>;
  hooks: SchemaHooks;
}

export function walkSchema(scheduler: SchemaScheduler, schema: VconSchema, value: SchemaValue) {
  walk(
    scheduler,
    new SchemaMetas(normalizedRootSchema(schema), SCHEMA_ROOT, undefined, value, ROOT_OBJECT, undefined),
    (_value) => {
      value = _value;
    },
  );

  return {
    result: value,
    scheduler,
  };
}

function matchSchemaTail(schema: JSONSchema, valueType: PropertyType): JSONSchema | void {
  if (
    (typeof schema.type === 'string' && valueType == schema.type) ||
    (Array.isArray(schema.type) && schema.type.includes(valueType)) ||
    schema.type === undefined ||
    schema.type === 'any'
  ) {
    return schema;
  }
}

function findSchemaNode(root: JSONSchema, valuePaths: string[], valueType: PropertyType): JSONSchema | void {
  if (!valuePaths.length) return root;

  let result: JSONSchema | void;
  const childPaths = valuePaths.concat();

  const parent = childPaths.shift();
  const hasChild = childPaths.length > 0;

  const parentTypes: PropertyType[] = Array.isArray(root.type) ? root.type : [root.type];

  if (parentTypes.includes('object')) {
    if (root.properties && parent in root.properties) {
      result = findSchemaNode(root.properties[parent], childPaths, valueType);
      if (result) return result;
    }

    if (isObject(root.additionalProperties) && parent in root.additionalProperties) {
      result = findSchemaNode(root.additionalProperties[parent], childPaths, valueType);
      if (result) return result;
    }

    if (root.additionalProperties === true) {
      return root;
    }
  }

  if (parentTypes.includes('array') && /^\d+$/.test(parent)) {
    if (root.items) {
      result = findSchemaNode(root.items, childPaths, valueType);
      if (result) return result;
    }

    return root;
  }

  if (!hasChild) {
    return matchSchemaTail(root, valueType);
  }
}

export function findSchemaNodeWithValue(root: JSONSchema, valuePaths: string[], value: any): JSONSchema | void {
  return findSchemaNode(root, valuePaths, typeOf(value) as any);
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

export const schemaErrorLog: ErrorCollectionOptions<SchemaError>['log'] = function (errors) {
  errorLog(`[vcon schema] got ${this.size} errors:\n`);

  errors.forEach((errorArr, path) => {
    errorLog(`Got ${errorArr.length} errors on ${cyan(path)}:`);
    for (let i = 0; i < errorArr.length; i++) {
      errorLog(`  <${errorArr[i].keyword}> at ${cyan(errorArr[i].schemaPath)}`, `${errorArr[i].message}`);
    }
    console.log();
  });
};
