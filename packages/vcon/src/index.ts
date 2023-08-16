import { SetupPlugin } from '@vcon/node';
import '@vcon/node/dist/cmd-args';

import { Vcon } from '@vcon/core';

const vcon = new Vcon({
  ext: ['.json', '.yaml', '.yml', '.json5'],
});

vcon.addPlugin(new SetupPlugin());

vcon.addConfig('path/to/project', 'default');
vcon.addConfig('path/to/name', ['development', 'production']);

// load which group dependends on process.env.NODE_ENV
vcon.load(process.env.NODE_ENV);

// Can also pass an array,The default group will be load when no configuration is found for process.env.NODE_ENV group
vcon.load([process.env.NODE_ENV, 'default']);

export default vcon;

export * from '@vcon/core';
