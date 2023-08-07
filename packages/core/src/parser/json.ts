import { VconLoadResult } from '../base/loader';
import { VconParser, VconParseResult, VconParseMeta } from '../base/parser';

export class JSONParser implements VconParser {
  private _exts = ['.json'];
  readonly name = 'json';

  parse(content: VconLoadResult | undefined, result: VconParseResult, meta: VconParseMeta): void | VconParseResult {
    if (!content || result || !this._exts.includes(meta.ext)) return result;

    return {
      config: JSON.parse(content.content),
    };
  }
}
