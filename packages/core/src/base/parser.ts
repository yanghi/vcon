import { VconLoadMeta, VconLoadResult } from './loader';
export interface VconParseResult {
  config: any;
}

export interface VconParseMeta extends VconLoadMeta {}

export abstract class VconParser {
  readonly name?: string;
  parse(loaded: VconLoadResult, result: VconParseResult | undefined, meta: VconParseMeta): VconParseResult | void {
    throw new Error('Must override parse() method');
  }
}
