const vcon = require('vcon').default;

if (vcon.getArgs().p) {
  vcon.addConfig('./configs/pass');
} else {
  vcon.addConfig('./configs/unpass');
}

vcon.setSchema({
  properties: {
    anyOf: {
      properties: {
        array: {
          items: {
            anyOf: [
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
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'array',
            },
          ],
        },
        stringOrArray_2: {
          anyOf: [
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
    oneOf: {
      properties: {
        numOrStr: {
          oneOf: [
            { type: 'string', maxLength: 3 },
            { type: 'number', maximum: 10 },
          ],
        },
        numOrStr_2: {
          oneOf: [
            { type: 'string', maxLength: 3 },
            { type: 'number', maximum: 10 },
          ],
        },
        numOrStrArr: {
          items: {
            oneOf: [
              { type: 'string', maxLength: 3 },
              { type: 'number', maximum: 10 },
            ],
          },
        },
      },
    },
    allOf: {
      properties: {
        str: {
          allOf: [
            { type: 'string', maxLength: 3 },
            { type: 'string', pattern: '^[a-z]+' },
          ],
        },
        str_2: {
          allOf: [
            { type: 'string', maxLength: 3 },
            { type: 'string', pattern: '^[a-z]+' },
          ],
        },
        strArr: {
          items: {
            allOf: [
              { type: 'string', maxLength: 3 },
              { type: 'string', pattern: '^[a-z]+' },
            ],
          },
        },
      },
    },
  },
});

vcon.load();
