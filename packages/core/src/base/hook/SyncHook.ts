export class SyncHook<L extends Function> {
  protected _handlers = new Set<L>();
  addHandler(handler: L) {
    this._handlers.add(handler);
  }
  get size() {
    return this._handlers.size;
  }
  removeHandler(handler: L): boolean {
    return this._handlers.delete(handler);
  }
  removeAllHandlers() {
    this._handlers.clear();
  }
  call(ctx: any, ...args: any[]): void {
    for (let cb of this._handlers) {
      cb.apply(ctx, args);
    }
  }
}
