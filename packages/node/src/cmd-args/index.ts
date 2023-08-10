import { dotProp, Vcon } from '@vcon/core';
import * as minimist from 'minimist';

declare module '@vcon/core/dist/base/vcon' {
  export interface Vcon extends VconArgsImpl {}
}

export interface VconArgsImpl {
  getArgs(): minimist.ParsedArgs;
  hasArg(path: string): boolean;
}

Vcon.extend<VconArgsImpl>({
  _args: undefined,
  _loadArgs() {
    if (!this._args) {
      this._args = minimist(process.argv.slice(2));
    }
  },
  hasArg(path) {
    return dotProp(this._args, path).has;
  },
  getArgs() {
    this._loadArgs();
    return this._args;
  },
  onInit() {
    this._loadArgs();
  },
});
