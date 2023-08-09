import { VconLoadResult } from '../base/loader';
import { VconParser, VconParseResult, VconParseMeta } from '../base/parser';
import { PARSER } from '../constans';
import { parse } from 'json5';

export class JSON5Parser implements VconParser {
  private _exts = ['.json5'];
  readonly name = PARSER.JSON5;

  parse(content: VconLoadResult | undefined, result: VconParseResult, meta: VconParseMeta): void | VconParseResult {
    if (!content || result || !this._exts.includes(meta.ext)) return result;

    return {
      config: parse(content.content),
    };
  }
}
