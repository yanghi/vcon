const vcon = require('vcon').default;
const assert = require('assert');

vcon.addConfig('./configs/default');
vcon.addConfig('./configs/json5');
vcon.addConfig('./configs/yaml');

process.env.NODE_ENV = 'test';

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
        ports: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      },
    },
    version: {
      type: 'integer',
    },
    env: {
      type: 'string',
    },
  },
});

vcon.hooks.schema.parseValue.addHandler((result, metas) => {
  if (metas.propertyName == 'version') {
    assert.equal(result, 1);

    return result + 1;
  }
});

vcon.hooks.schema.parseValue.addHandler((result, metas) => {
  if (metas.propertyName == 'version') {
    assert.equal(result, 2);
    return result * 10;
  }
});

assert.equal(vcon.get('version'), 20);

const { sources } = vcon.load();

assert.equal(vcon.getAllConfigSources().length, 1, `vcon.getAllConfigSources() should get all sources`);

assert.equal(vcon.get('app.foo'), 'foo', `vcon.get() return correct value`);
assert.equal(vcon.has('app.foo'), true, `vcon.has() return correct value`);
assert.equal(typeof vcon.getArgs()._, 'object', `vcon.getArgs() return correct arguments`);

assert.equal(vcon.get('app.missed'), 'miss', `fill default value if filed missed`);

assert(vcon.addExtension('.js').includes('.js'));
assert.deepEqual(vcon.setOptions({ ext: ['.js', '.ts'] }, true).ext, ['.js', '.ts'], 'options should be overridden');

assert.equal(sources.length, 1, 'load() should return sources');

var newVal = 'new value';
var setResult = vcon.set('app.foo', newVal);

assert.equal(setResult.errors.length, 0);
assert.equal(newVal, vcon.get('app.foo'));

assert.equal(vcon.get('app.ports.0'), 3000);

var newVal_2 = 8080;
var setResult_2 = vcon.set('app.ports.0', newVal_2);

assert.equal(setResult_2.errors.length, 0);
assert.equal(newVal_2, vcon.get('app.ports.0'));

var setResultFailed = vcon.set('app.ports.0', 'foo');
assert.equal(setResultFailed.errors.length, 1);

assert.equal(vcon.get('env'), 'test');
