const vcon = require('vcon').default;

if (vcon.getArgs().p) {
  vcon.addConfig('./configs/pass');
} else {
  vcon.addConfig('./configs/unpass');
}

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
    not: {
      properties: {
        str: {
          not: [{ type: 'string' }],
        },
        num: {
          not: [{ type: 'number' }],
        },
        numArray: {
          items: {
            not: [{ type: 'number' }],
          },
        },
      },
    },
  },
});

vcon.load();
