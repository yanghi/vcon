import * as path from 'path';

export type SourceType = 'fs' | 'default';
export interface NormalizedSourceOptions {
  ext: string[];
  path: string;
  sourceType: SourceType;
}

export interface SourceOptions extends Partial<Omit<NormalizedSourceOptions, 'sourceType'>> {}

export interface SingleSourceOptions extends Omit<NormalizedSourceOptions, 'ext'> {
  ext: string;
  path: string;
  config?: any;
}

export function normalizeToSingleSourceOptions(options: NormalizedSourceOptions): SingleSourceOptions[] {
  let result: SingleSourceOptions[];

  const extname = path.extname(options.path);

  if (extname) {
    result = [Object.assign(options, { ext: extname, sourceType: 'fs' })];
  } else {
    result = options.ext.map((ext) => ({
      ...options,
      ext,
      sourceType: 'fs',
      path: options.path + ext,
    }));
  }

  return result;
}
