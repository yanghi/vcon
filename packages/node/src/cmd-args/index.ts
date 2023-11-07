import { dotProp, Vcon } from '@vcon/core';
import * as minimist from 'minimist';

declare module '@vcon/core/dist/base/vcon' {
  export interface Vcon extends VconArgs {}
}

export interface VconArgs {
  getArgs(): minimist.ParsedArgs;
  hasArg(name: string): boolean;
  arg(name: string): any;
}

Vcon.extend<VconArgs>({
  _args: undefined,
  _loadArgs() {
    if (!this._args) {
      this._args = minimist(process.argv.slice(2));
    }
  },
  hasArg(name) {
    return dotProp(this._args, name).has;
  },
  getArgs() {
    this._loadArgs();
    return this._args;
  },
  arg(name) {
    if (!this._args) {
      this._loadArgs();
    }

    return this._args[name];
  },
  onInit() {
    this._loadArgs();
  },
});
