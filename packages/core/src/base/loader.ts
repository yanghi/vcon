export interface VconLoadResult {
  content: string;
}

export interface VconLoadMeta {
  ext: string;
  group?: string;
  path: string;
  sourceType: 'fs';
}

export interface VconLoader {
  readonly name: string;
  load(result: VconLoadResult | undefined, meta: VconLoadMeta): VconLoadResult | void;
}
