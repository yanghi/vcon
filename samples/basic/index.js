const vcon = require('vcon').default;

vcon.addConfig('./configs/default');
vcon.addConfig('./configs/myConfig.yaml');

vcon.load();

console.log('get all config sources', vcon.getAllConfigSources());
console.log('get app.foo', vcon.get('app.foo'));
console.log('has app.foo', vcon.has('app.foo'));
