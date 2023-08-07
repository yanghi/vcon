import { SetupPlugin } from '@vcon/node';
import { Vcon } from '@vcon/core';

const vcon = new Vcon();

vcon.addPlugin(new SetupPlugin());

export default vcon;

export * from '@vcon/core';
