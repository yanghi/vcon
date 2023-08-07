import { VconLoadMeta, VconLoadResult } from './loader';
export interface VconParseResult {
  config: any;
}

export interface VconParseMeta extends VconLoadMeta {}

export interface VconParser {
  readonly name: string;
  parse(content: VconLoadResult, result: VconParseResult | undefined, meta: VconParseMeta): VconParseResult | void;
}
