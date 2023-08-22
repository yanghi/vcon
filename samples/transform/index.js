const vcon = require('vcon').default;
const assert = require('assert');

vcon.addConfig('./configs/vcon');
vcon.setSchema({
  type: 'object',
  properties: {
    port: {
      type: 'integer',
      transform: true,
    },
    str: {
      type: 'string',
      transform: true,
    },
    integer: {
      type: 'integer',
      transform: true,
    },
    debug: {
      type: 'boolean',
      transform: true,
    },
    num: {
      type: 'number',
      transform: true,
    },
  },
});

vcon.load();
assert.equal(vcon.get('port'), 3000);
assert.equal(vcon.get('str'), '2');
assert.equal(vcon.get('integer'), 1);
assert.equal(vcon.get('debug'), true), assert.equal(vcon.get('num'), 4);
