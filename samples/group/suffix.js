const vcon = require('vcon').default;
const assert = require('assert');

vcon.addConfig('./configs/vcon', ['prod', 'default']);
vcon.addConfig('./configs/vcon', 'dev');

const type = vcon.getArgs().type;

vcon.load({
  group: type,
});

assert(['dev', 'prod', 'default', undefined].includes(type));

if (type === 'default') {
  assert.equal(vcon.get('name'), 'vcon.prod', `loaded group ${type}`);
} else if (!type) {
  assert.equal(vcon.get('name'), 'vcon.prod', `loaded default`);
} else {
  assert.equal(vcon.get('name'), 'vcon.' + type, `loaded group ${type}`);
}
