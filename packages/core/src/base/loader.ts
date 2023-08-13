import { SourceType } from './sourceOptions';

export interface VconLoadResult {
  content: string;
}

export interface VconLoadMeta {
  ext: string;
  group?: string;
  path: string;
  sourceType: SourceType;
}

export interface VconLoader {
  readonly name: string;
  load(result: VconLoadResult | undefined, meta: VconLoadMeta): VconLoadResult | void;
}
