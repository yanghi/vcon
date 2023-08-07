## Vcon

Customizable configuration controls.

### Basic usage

```js
import vcon from 'vcon';

vcon.addConfig('./configs/default');
vcon.addConfig('./configs/myConfig.yaml');

vcon.load();

console.log('get app.foo', vcon.get('app.foo'));
console.log('has app.foo', vcon.has('app.foo'));
```
