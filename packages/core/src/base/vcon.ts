import { VconSchema } from './schema';
import { VconParser, VconParseResult } from './parser';
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

export interface VconNormalizedOptions {
  ext: string[];
}

export interface VconOptions extends Partial<VconNormalizedOptions> {}

const defaults: Partial<VconNormalizedOptions> = {
  ext: ['.json', '.yaml', '.yml'],
};

function normalizeSourceOptions(options: VconOptions): VconNormalizedOptions {
  const normalizedOptions: VconNormalizedOptions = options as VconNormalizedOptions;
  if (!normalizedOptions.ext) {
    normalizedOptions.ext = defaults.ext;
  }

  return normalizedOptions;
}

export interface AddConfigOptions {
  ext?: string[];
}

export interface VConSource extends VconParseResult {
  options: SingleSourceOptions;
}

export class Vcon {
  private _loaders = new Map<string, VconLoader>();
  private _parsers = new Map<string, VconParser>();
  private _plugins = new Map<string, VconPlugin>();

  private _sourceOptions: NormalizedSourceOptions[] = [];

  private _load = false;

  private _options: VconNormalizedOptions;

  private __init_hooks__?: Function[];
  constructor(options: VconOptions = {}) {
    this._options = normalizeSourceOptions(options);

    const initHooks = Object.getPrototypeOf(this).__init_hooks__;

    if (Array.isArray(initHooks)) {
      initHooks.forEach((hook) => hook.call(this, this._options));
    }
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
    const name = parser.name;

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
  addConfig(path: string, options: SourceOptions | string[] = {}) {
    const normalizedOptions: NormalizedSourceOptions = {
      path,
      ...(Array.isArray(options) ? { ext: options } : options),
    } as any;

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
  private _configSources: VConSource[] = [];
  getAllConfigSources(): VConSource[] {
    return this._configSources;
  }
  load() {
    if (this._load) return;

    this._load = true;

    this._setupPlugins();

    this._sourceOptions.forEach((options) => {
      normalizeToSingleSourceOptions(options).forEach((singleOpts) => {
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
            }
          } catch (error) {
            console.error(`${parser.name} parse error`, error);
          }
        }

        if (parseResult !== undefined) {
          this._configSources.push({
            ...parseResult,
            options: singleOpts,
          });
        }
      });
    });

    if (this._schema) {
      walkSchema(this._schema, this._configSources[0]?.config);
    }
  }
  private _schema?: VconSchema | undefined;
  setSchema(schema: VconSchema) {
    this._schema = schema;
  }
}
