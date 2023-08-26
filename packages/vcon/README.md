## Vcon

Customizable configuration controls.

### Basic usage

```js
import vcon from 'vcon';

// Add configuration source from command-line arguments
if (vcon.getArgs().config) {
  vcon.addConfig(vcon.getArgs().config);
}

// Omitting the file extension, it will attempt to load all supported extensions.
vcon.addConfig('./configs/default');
vcon.addConfig('./configs/myConfig.yaml');

// use a config schema similar as json-shema to verify and transform
vcon.setSchema({
  type: 'object',
  properties: {
    app: {
      properties: {
        port: {
          type: 'number',
          default: 3000,
        },
        prefixs: {
          type: 'array',
          required: true,
          items: {
            type: 'string',
          },
        },
      },
    },
  },
});

vcon.load();

console.log('get app.port', vcon.get('app.port'));
console.log('get app.prefixs', vcon.get('app.prefixs'));
console.log('has app.foo', vcon.has('app.foo'));
```

<<<<<<< HEAD

## Configuration Group

Vcon allows add a configuration source to one or more groups sources, and you can decide which groups will be used as available configuration sources when call `vcon.load()`.

If the configuration file does not exist for the specified group, it will try to load the unnamed group.

Anyway, Only the first matching valid configuration file will be used as the configuration source

```ts
vcon.addConfig('path/to/project', 'default');
// it's same as above
vcon.addConfig('path/to/project', { group: 'default' });

vcon.addConfig('other/path/project', 'default');
vcon.addConfig('path/to/name', ['development', 'production']);

// unnamed group
vcon.addConfig('path/to/unnamed-group');

// load which group dependends on process.env.NODE_ENV
vcon.load(process.env.NODE_ENV);

// can also pass an array,The default group will be load when no configuration is found for process.env.NODE_ENV group
vcon.load([process.env.NODE_ENV, 'default']);

// try load all
vcon.load();
```

By default, the name of the group can be loaded as the suffix of the file name.

`vcon.addConfig('path/to/project', 'default')` has the same effect as the following code:

```ts
vcon.addConfig('path/to/project.default');
vcon.addConfig('path/to/project');
```

**How to disable group suffix?**

there has two way:

```ts
// disable single group
vcon.addConfig(path, { groupSuffix: false });

// disable all
vcon.load({ group: ['group'], groupSuffix: false });
```

## Schema

Vcon implemented some basically features of json-schema for verification.

The supported features table below:

| Field                | Type                                  | Description                                    |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| type                 | `PropertyType \| Array<PropertyType>` | Defines the data type                          |
| properties           | `Record<string, JSONSchema>`          | Specifies the object's properties              |
| required             | `Array<string> \| boolean`            | Lists the required properties                  |
| items                | `JSONSchema`                          | Defines the schema of items                    |
| additionalProperties | `boolean`                             | Specifies if additional properties are allowed |
| default              | `SchemaValue`                         | Specifies the default value                    |
| title                | `string`                              | Provides a title for the schema                |
| description          | `string`                              | Describes the purpose of the schema            |
| maximum              | `number`                              | Defines the maximum value allowed              |
| minimum              | `number`                              | Defines the minimum value allowed              |
| maxLength            | `Integer`                             | Specifies the maximum string length            |
| minLength            | `Integer`                             | Specifies the minimum string length            |
| enum                 | `Array<SchemaValue>`                  | Lists the allowable values                     |
| maxItems             | `Integer`                             | Defines the maximum number of items            |
| minItems             | `Integer`                             | Defines the minimum number of items            |
| uniqueItems          | `boolean`                             | Indicates if array items must be unique        |
| pattern              | `string`                              | Specifies a regular expression pattern         |
| oneOf                | `JSONSchema` \| Array<JSONSchema>     | Must be valid against exactly one of subschema |
| not                  | Array<JSONSchema>                     | Defines undesired rules                        |

Related type definitions

```ts
// string of value type
type PropertyType = 'object' | 'array' | 'string' | 'boolean' | 'number' | 'null' | 'integer';

// value type
type SchemaValue = string | number | boolean | SchemaArray | SchemaObject | null;

type SchemaObject = {
  [x: string]: SchemaValue;
};

type SchemaArray = Array<SchemaValue>;
```

## Additional Schema Definition

**tranform**

When the value is of an unexpected type, tranform will be used to convert the value.

if `tranform` set is `true`,will use transformers that may convert the corresponding type will be used.

```js
vcon.setSchema({
  type: 'object',
  properties: {
    port: {
      type: 'integer',
      transform: true,
    },
  },
});
```

## Supported configuration file extensions

Vcon supports the following file extensions by default，You can implement a `Parser` to support more file extensions，about `Parser` see next section

- `.json`
- `.yaml`
- `.yml`
- `.json5`

## Parser

Vcon use Parser to convert the content of the configuration file content.

Here is an example for parse a '.toml' configuration file

```ts
import vcon, { VconLoadResult, VconParseMeta, VconParseResult, VconParser } from 'vcon';

class TomlParser implements VconParser {
  parse(loaded, VconLoadResult | undefined, result: VconParseResult, meta: VconParseMeta): void | VconParseResult {
    // Results of other Parser transformations
    result;

    if (meta.ext === '.toml') {
      try {
        return {
          config: toml.parse(loaded.content),
        };
      } catch (e) {
        console.error('Parsing error on line ' + e.line + ', column ' + e.column + ': ' + e.message);
      }
    }
  }
}

vcon.addParser(new TomlParser());
vcon.addExtension('.toml');
// now you can use '.toml' file
vcon.addConfig('path/to/name.toml');
```
