## Vcon

Customizable configuration controls.

### Basic usage

```js
import vcon from 'vcon';

// Add configuration source from command-line arguments
if (vcon.getArgs().config) {
  vcon.addConfig(vcon.getArgs().config);
}

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

| Name                 | Type                                  | Descrition                                                                                                                                                        |     |     |     |     |     |     |     |
| -------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | --- | --- | --- | --- |
| type                 | `PropertyType \| Array<PropertyType>` | Specifies the data type of the value                                                                                                                              |     |     |     |     |     |     |     |
| properties           | `Record<string, JSONSchema>`          | Defines an object's properties and their respective JSON Schema definitions.                                                                                      |     |     |     |     |     |     |     |
| default              | `SchemaValue`                         | Provides a default value for a property or an array element if it is not explicitly defined.                                                                      |     |     |     |     |     |     |     |
| required             | `Array<string>`                       | Specifies the properties that must be present in the object. It is an array of property names.                                                                    |     |     |     |     |     |     |     |
| additionalProperties | `JSONSchema \| boolean`               | Specifies whether additional properties which are not defined in "properties" are allowed in the object or not. It can be a boolean value or a schema definition. |     |     |     |     |     |     |     |
| items                | `JSONSchema`                          | Defines the schema of the array elements. It can be a single schema or an array of schemas if the array can have different types of elements.                     |     |     |     |     |     |     |     |

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
