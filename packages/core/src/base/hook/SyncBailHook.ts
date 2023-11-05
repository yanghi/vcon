import { SyncHook } from './SyncHook';

type HookHandler = (result: any, ...args: any[]) => any;

export class SyncBailHook<L extends HookHandler> extends SyncHook<L> {
  call<V = any>(ctx: any, ...args: Parameters<L>): V {
    let result = args[0];
    for (let cb of this._handlers) {
      let current = cb.apply(ctx, args);

      if (current) {
        result = args[0] = current;
      }
    }

    return result;
  }
}
