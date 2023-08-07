import { VconParseMeta, VconParser, VconParseResult } from '../base/parser';
import { PARSER } from '../constans';
import { parse } from 'yaml';
import { VconLoadResult } from '../base/loader';

export class YAMLParser implements VconParser {
  private _exts = ['.yaml', '.yml'];
  readonly name = PARSER.YAML;

  parse(content: VconLoadResult, result: VconParseResult, meta: VconParseMeta): void | VconParseResult {
    if (!content || result || !this._exts.includes(meta.ext)) return result;

    return {
      config: parse(content.content),
    };
  }
}
