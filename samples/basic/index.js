const vcon = require('vcon').default;
const assert = require('assert');

vcon.addConfig('./configs/default');
vcon.addConfig('./configs/json5');
vcon.addConfig('./configs/yaml');

vcon.setSchema({
  properties: {
    app: {
      type: 'object',
      properties: {
        foo: {
          type: 'string',
        },
        missed: {
          default: 'miss',
        },
      },
    },
  },
});

vcon.load();

assert.equal(vcon.getAllConfigSources().length, 3, `vcon.getAllConfigSources() should get all sources`);

assert.equal(vcon.get('app.foo'), 'foo', `vcon.get() return correct value`);
assert.equal(vcon.has('app.foo'), true, `vcon.has() return correct value`);
assert.equal(typeof vcon.getArgs()._, 'object', `vcon.getArgs() return correct arguments`);

assert.equal(vcon.get('app.missed'), 'miss', `fill default value if filed missed`);
