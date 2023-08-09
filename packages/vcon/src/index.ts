import { SetupPlugin } from '@vcon/node';
import { Vcon } from '@vcon/core';

const vcon = new Vcon({
  ext: ['.json', '.yaml', '.yml', '.json5'],
});

vcon.addPlugin(new SetupPlugin());

export default vcon;

export * from '@vcon/core';
