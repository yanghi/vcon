const vcon = require('vcon').default;
const assert = require('assert');

const shouldPass = vcon.getArgs().p;
if (shouldPass) {
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

vcon.setOptions({
  log: false,
});

const { error } = vcon.load();

const shouldExpectErrorCount = 15;
var expected = 0;

if (shouldPass) {
  assert.equal(error.length, 0, 'No error');
} else {
  assert.equal(error.length, shouldExpectErrorCount, 'Has errors');

  hasErrorOnShemaPath('#/properties/anyOf/properties/array/items/anyOf', 2);
  hasErrorOnShemaPath('#/properties/anyOf/properties/stringOrArray/anyOf', 1);
  hasErrorOnShemaPath('#/properties/not/properties/str/not', 1);
  hasErrorOnShemaPath('#/properties/not/properties/num/not', 1);
  hasErrorOnShemaPath('#/properties/not/properties/numArray/items/not', 2);
  hasErrorOnShemaPath('#/properties/oneOf/properties/numOrStr/oneOf', 1);
  hasErrorOnShemaPath('#/properties/oneOf/properties/numOrStr_2/oneOf', 1);
  hasErrorOnShemaPath('#/properties/oneOf/properties/numOrStrArr/items/oneOf', 2);
  hasErrorOnShemaPath('#/properties/allOf/properties/str/allOf', 1);
  hasErrorOnShemaPath('#/properties/allOf/properties/str_2/allOf', 1);
  hasErrorOnShemaPath('#/properties/allOf/properties/strArr/items/allOf', 2);

  assert.equal(expected, shouldExpectErrorCount, 'Should expect error count');
}

function hasErrorOnShemaPath(path, count) {
  // console.log('hasError',Array.from(error.entries()))
  assert.equal(error.filter((e) => e.schemaPath === path).length, count, `Has ${count} errors on ${path}`);
  expected += count;
}

function expectErrorOnShemaPath() {
  const map = new Map();

  error.forEach((e) => {
    map.set(e.schemaPath, (map.get(e.schemaPath) || 0) + 1);
  });
  map.forEach((val, key) => {
    console.log(` hasErrorOnShemaPath('${key}', ${val})`);
  });
}
