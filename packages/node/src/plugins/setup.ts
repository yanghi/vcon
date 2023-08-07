import { JSONParser, Vcon, VconPlugin, YAMLParser } from '@vcon/core';
import { FsLoader } from '../loader/fs';

export class SetupPlugin implements VconPlugin {
  name = 'SetupPlugin';
  setup(vcon: Vcon) {
    vcon.addLoader(new FsLoader());
    vcon.addParser(new JSONParser());
    vcon.addParser(new YAMLParser());
  }
}
