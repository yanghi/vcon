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

## Schema

Vcon implemented some basically features of json-schema for verification.

The supported features table below:

| Field                | Type                                  | Description                                    |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| type                 | `PropertyType \| Array<PropertyType>` | Defines the data type                          |
| properties           | `Record<string, JSONSchema>`          | Specifies the object's properties              |
| required             | `Array<string>\|boolean`              | Lists the required properties                  |
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
