import {
  VconSchema,
  SchemaError,
  JSONSchema,
  findSchemaNodeWithValue,
  SchemaHooks,
  SchemaScheduler,
  schemaErrorLog,
} from './schema';
import { VconParser } from './parser';
import { VconLoader } from './loader';
import {
  NormalizedSourceOptions,
  normalizeToSingleSourceOptions,
  SingleSourceOptions,
  SourceOptions,
} from './sourceOptions';
import { VconPlugin } from './plugin';
import { dotProp } from '../utils/dotProp';
import { walkSchema } from './schema';
import { IError } from './error';
import { SyncBailHook } from './hook/SyncBailHook';
import { ErrorCollection } from './ErrorCollection';

export interface VconNormalizedOptions {
  ext: string[];
  /**
   * Exit the process when no configuration is found, default is `true`
   */
  noConfigExit?: boolean;
  log?: 'error' | 'warning' | boolean;
  strict?: boolean;
}

export interface VconOptions extends Partial<VconNormalizedOptions> {}

const defaults: VconNormalizedOptions = {
  ext: ['.json', '.yaml', '.yml'],
  log: true,
};

function normalizeOptions(options: VconOptions): VconNormalizedOptions {
  const normalizedOptions: VconNormalizedOptions = Object.assign({}, defaults, options);

  return normalizedOptions;
}

export interface AddConfigOptions {
  ext?: string[];
}

export interface VconSource<Config = any> {
  config: any;
  options: SingleSourceOptions;
}

export class Vcon {
  private _loaders = new Map<string, VconLoader>();
  private _parsers = new Map<string, VconParser>();
  private _plugins = new Map<string, VconPlugin>();

  private _sourceOptions: NormalizedSourceOptions[] = [];

  private _loaded: LoadResult | null = null;

  private _options: VconNormalizedOptions;

  private __init_hooks__?: Function[];

  readonly hooks: {
    schema: SchemaHooks;
  } = {
    schema: {
      parseValue: new SyncBailHook(),
    },
  };

  private _schemaScheduler: SchemaScheduler;

  constructor(options: VconOptions = {}) {
    this._options = normalizeOptions(options);

    this._schemaScheduler = {
      error: new ErrorCollection({
        log: schemaErrorLog,
        strict: this._options.strict,
      }),
      hooks: this.hooks.schema,
    };

    const initHooks = Object.getPrototypeOf(this).__init_hooks__;

    if (Array.isArray(initHooks)) {
      initHooks.forEach((hook) => hook.call(this, this._options));
    }

    if (process.env.NODE_ENV == 'development') {
      ['setOptions', 'addExtension', 'addParser', 'addLoader', 'addPlugin', 'setSchema'].forEach((fnName) => {
        const originFn = this[fnName].bind(this);
        this[fnName] = function (...args: any[]) {
          if (this._loaded) {
            console.warn(`should call ${fnName}() before vcon.load(), it will not take effect.`);
          }
          originFn(...args);
        };
      });
    }
  }
  public setOptions(options: VconOptions, override?: boolean): VconNormalizedOptions {
    if (override) return (this._options = normalizeOptions(options));

    return Object.assign(this._options, options);
  }
  public getOptions(): VconNormalizedOptions {
    return this._options;
  }
  public addExtension(extension: string | string[]): string[] {
    const exts = Array.isArray(extension) ? extension : [extension];

    this._options.ext.push(...exts);
    return this._options.ext;
  }
  static extend<P>(
    props: P &
      Record<any, any> & {
        onInit?: (options: VconNormalizedOptions) => void;
      },
  ) {
    if (props.onInit) {
      if (!this.prototype.__init_hooks__) {
        this.prototype.__init_hooks__ = [];
      }
      this.prototype.__init_hooks__.push(props.onInit);
      delete props.onInit;
    }

    Object.assign(this.prototype, props);
  }
  addParser(parser: VconParser) {
    let name = parser.name;

    if (!name) {
      const proto = Object.getPrototypeOf(parser);
      name = proto.constructor.name;
    }
    if (!name) {
      throw new Error(`Must provide a name property for the parser`);
    }

    this._parsers.set(name, parser);
  }
  addLoader(loader: VconLoader) {
    const name = loader.name;
    this._loaders.set(name, loader);
  }
  addPlugin(plugin: VconPlugin) {
    const name = plugin.name;
    this._plugins.set(name, plugin);
  }
  addConfig(path: string, groups?: string | string[]): void;
  addConfig(path: string, options?: SourceOptions): void;
  addConfig(path: string, options?: SourceOptions | string[] | string) {
    const normalizedOptions: NormalizedSourceOptions = {
      path,
      ...(Array.isArray(options) ? { groups: options } : typeof options === 'string' ? { groups: [options] } : options),
    } as any;

    if (normalizedOptions.groupSuffix === undefined) {
      normalizedOptions.groupSuffix = true;
    }

    if (!normalizedOptions.ext) {
      normalizedOptions.ext = this._options.ext;
    }

    this._sourceOptions.push(normalizedOptions);
    return this;
  }

  private _setupPlugins() {
    for (const [_, plugin] of this._plugins) {
      plugin.setup(this, this._options);
    }
  }
  get<T = any>(path: string): T {
    this.load();

    return dotProp(this._configSources[0]?.config, path).value;
  }
  has(path: string): boolean {
    return dotProp(this._configSources[0]?.config, path).has;
  }
  set(path: string, value: any, setOptions: SetOptions = {}): { value?: any; errors: IError[] } {
    const dotPaths = path.split('.');
    const parentPath = dotPaths.slice(0, dotPaths.length - 1);
    const parent = dotProp(this._configSources[0]?.config, parentPath);

    if (!parent.has) {
      return {
        errors: [new Error(`No configuration item for "${parentPath.join('.')}",so "${path}" cannot be set.`)],
      };
    }

    if (this._schema) {
      const targetSchema = setOptions.schemaPath
        ? this.getSchema(setOptions.schemaPath)
        : findSchemaNodeWithValue(this._schema, dotPaths, value);

      const scheduler = this._schemaScheduler;

      if (targetSchema) {
        const { result } = walkSchema(scheduler, targetSchema, value);

        if (scheduler.error.size) {
          const errors = scheduler.error.errorList();
          setOptions.onError?.(errors);

          return {
            errors,
          };
        }

        parent.value[dotPaths[dotPaths.length - 1]] = result;

        return {
          value: result,
          errors: [],
        };
      }
    }

    parent[dotPaths.length - 1] = value;

    return {
      errors: [],
      value,
    };
  }
  private getSchema(path: string): JSONSchema | undefined {
    if (this._schema) {
      const paths = path.split('/');
      if (paths[0] === '#') {
        paths.shift();
      }

      return dotProp(this._schema, paths).value;
    }
  }
  private _configSources: VconSource[] = [];
  getAllConfigSources(): VconSource[] {
    return this._configSources;
  }
  private _getLoadSourceOptions(group?: LoadOptions['group']): NormalizedSourceOptions[] {
    if (!group || !group.length) return this._sourceOptions;
    const groups = Array.isArray(group) ? group : [group];

    const orderGroupsTuple: Array<[string, NormalizedSourceOptions[]]> = groups.map((group) => [group, []]);
    const namelessGroups: NormalizedSourceOptions[] = [];

    for (let i = 0; i < this._sourceOptions.length; i++) {
      const singleOptions = this._sourceOptions[i];

      if (singleOptions.groups) {
        const orderGroup = orderGroupsTuple.find((groupOrderOption) =>
          singleOptions.groups.includes(groupOrderOption[0]),
        );

        if (orderGroup) {
          orderGroup[1].push(singleOptions);
        }
      } else {
        namelessGroups.push(singleOptions);
      }
    }

    return orderGroupsTuple
      .reduce((prev, ordered) => prev.concat(ordered[1]), [] as NormalizedSourceOptions[])
      .concat(namelessGroups);
  }

  private _load(options: LoadOptions): VconSource[] {
    const configSources: VconSource[] = [];

    const { group } = options;
    const race = true;

    const sourceOptions = this._getLoadSourceOptions(group);

    const loadedSourceOptions: NormalizedSourceOptions[] = [];

    const overwriteOptions: (opts: NormalizedSourceOptions) => NormalizedSourceOptions =
      options.groupSuffix === undefined
        ? (opt) => opt
        : (opt) => Object.assign({}, opt, { groupSuffix: options.groupSuffix });

    for (let i = 0; i < sourceOptions.length; i++) {
      const options = sourceOptions[i];

      if (loadedSourceOptions.includes(options)) continue;

      loadedSourceOptions.push(options);

      const singleSourceOptions = normalizeToSingleSourceOptions(overwriteOptions(options), this._options.ext);

      for (let j = 0; j < singleSourceOptions.length; j++) {
        const singleOpts = singleSourceOptions[j];

        let loadResult: any;
        for (const [_, loader] of this._loaders) {
          try {
            const _loadResult = loader.load(loadResult, singleOpts);
            if (_loadResult) {
              loadResult = _loadResult;
            }
          } catch (error) {
            console.error(`${loader.name} load error`, error);
          }
        }

        let parseResult: any;

        for (const [_, parser] of this._parsers) {
          try {
            const _parseRes = parser.parse(loadResult, parseResult, singleOpts);
            if (_parseRes) {
              parseResult = _parseRes;

              configSources.push({
                ...parseResult,
                options: singleOpts,
              });

              if (race && parseResult) {
                return configSources;
              }
            }
          } catch (error) {
            console.error(`${parser.name} parse error`, error);
          }
        }
      }
    }

    return configSources;
  }

  load<Config = any>(group?: string | string[]): LoadResult<Config>;
  load<Config = any>(options?: LoadOptions): LoadResult<Config>;
  load(groupOrOptions: LoadOptions | string | string[]): LoadResult {
    if (this._loaded) return this._loaded;

    const loadResult: LoadResult = {
      error: [],
      sources: [],
    };

    this._setupPlugins();

    const options =
      Array.isArray(groupOrOptions) || typeof groupOrOptions === 'string'
        ? { group: groupOrOptions }
        : groupOrOptions || {};

    loadResult.sources = this._configSources = this._load(options);

    if (!this._configSources.length) {
      console.warn(`[vcon warn]: No match any config sources`);
    }

    if (this._schema) {
      const { result, scheduler } = walkSchema(
        this._schemaScheduler,
        this._schema,
        dotProp(this._configSources, '0.config').value,
      );

      const schemaErrors = scheduler.error.errorList();

      if (schemaErrors.length) {
        this._options.log && scheduler.error.log();
        loadResult.error.push(...schemaErrors);
      }

      if (this._configSources.length) {
        this._configSources[0].config = result;
      } else {
        this._configSources.push({
          config: result,
          options: {
            sourceType: 'default',
          } as any,
        });
      }
    }

    if (!this._configSources.length) {
      if (this._options.noConfigExit || this._options.strict) {
        console.error(`[vcon error]: exit code =1, No config sources found`);
        process.exit(1);
      } else {
        console.error(`[vcon error]: No config sources found`);
      }
    }

    return (this._loaded = loadResult);
  }
  private _schema?: VconSchema | undefined;
  setSchema(schema: VconSchema) {
    this._schema = schema;
  }

  /**
   * Create an instance with the same features as the current instance,inherited the same options/plugins/parsers
   */
  create(options: VconOptions = {}): Vcon {
    const instance = new Vcon(this._options);

    instance.setOptions(options, false);

    for (const [_, parser] of this._parsers) {
      instance.addParser(parser);
    }

    for (const [_, plugin] of this._plugins) {
      instance.addPlugin(plugin);
    }

    return instance;
  }
}

interface LoadResult<Config = any> {
  error: SchemaError[];
  sources: VconSource<Config>[];
}

interface LoadOptions {
  group?: string | string[];
  groupSuffix?: boolean;
}
export interface SetOptions {
  schemaPath?: string;
  onError?: (errs: IError[]) => void;
}
