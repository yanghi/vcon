import * as path from 'path';
import { withDot } from '../utils';

export type SourceType = 'fs' | 'default';
export interface NormalizedSourceOptions {
  ext: string[];
  path: string;
  sourceType: SourceType;
  groups?: string[];
  groupSuffix?: boolean;
}

export interface SourceOptions extends Partial<Omit<NormalizedSourceOptions, 'sourceType' | 'groups'>> {
  group?: string | string[];
}

export interface SingleSourceOptions extends Omit<NormalizedSourceOptions, 'ext'> {
  ext: string;
  path: string;
  config?: any;
  group?: string;
}

export function normalizeToSingleSourceOptions(
  options: NormalizedSourceOptions,
  allowedExts: string[],
): SingleSourceOptions[] {
  let result: SingleSourceOptions[] = [];

  const extname = path.extname(options.path);

  if (extname && allowedExts.includes(extname)) {
    return (result = [Object.assign(options, { ext: extname, sourceType: 'fs' })]);
  } else if (options.groups && options.groupSuffix) {
    for (let i = 0; i < options.groups.length; i++) {
      const group = options.groups[i];
      const dotGroup = withDot(group);

      for (let j = 0; j < options.ext.length; j++) {
        const ext = options.ext[j];

        result.push({
          ...options,
          ext,
          group,
          sourceType: 'fs',
          path: options.path + dotGroup + ext,
        });
        // without group suffix
        result.push({
          ...options,
          ext,
          group,
          sourceType: 'fs',
          path: options.path + ext,
        });
      }
    }
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
