const vcon = require('vcon').default;

vcon.addConfig('./configs/pass');

vcon.setSchema({
  properties: {
    oneOf: {
      properties: {
        array: {
          items: {
            oneOf: [
              {
                type: 'number',
              },
              {
                properties: {
                  age: {
                    type: 'number',
                  },
                },
              },
            ],
          },
        },
        stringOrArray: {
          oneOf: [
            {
              type: 'string',
            },
            {
              type: 'array',
            },
          ],
        },
        stringOrArray_2: {
          oneOf: [
            {
              type: 'string',
            },
            {
              type: 'array',
            },
          ],
        },
      },
    },
  },
});

vcon.load();
