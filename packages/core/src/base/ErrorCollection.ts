import { IError } from './error';

export interface ErrorCollectionOptions<E extends IError = Error> {
  strict?: boolean;
  log?(this: ErrorCollection<E>, error: ErrorCollection<E>['errors']): void;
}

export class ErrorCollection<E extends IError = Error> {
  private errors = new Map<string, E[]>();
  constructor(public options: ErrorCollectionOptions<E> = {}) {}
  private _size: number = 0;
  get size() {
    return this._size;
  }
  log() {
    if (this.errors.size) {
      if (this.options.log) {
        return this.options.log.call(this, this.errors);
      }

      console.log(`[Vcon] got ${this._size} errors:`);
      this.errors.forEach((errors, key) => {
        console.log(`Got ${errors.length} errors on ${key}:`);
        for (let i = 0; i < errors.length; i++) {
          console.log('  ', errors[i].message);
        }
      });
    }
  }
  add(name: string, e: E | void | undefined | E[]) {
    if (e) {
      if (!this.errors.has(name)) {
        this.errors.set(name, []);
      }
      const group = this.errors.get(name);
      if (Array.isArray(e)) {
        group.push(...e);
        this._size += e.length;
      } else {
        group.push(e);
        this._size++;
      }
      if (this.options.strict) {
        this.log();
        if (global && global.process) {
          process.exit(1);
        }
      }
    }
  }
  values() {
    return this.errors.values();
  }
  get(name: string) {
    return this.errors.get(name);
  }
  errorList() {
    let all: E[] = [];

    this.errors.forEach((arr) => {
      all = all.concat(arr);
    });

    return all;
  }
}
