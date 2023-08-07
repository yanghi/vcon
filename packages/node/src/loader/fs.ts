import { VconLoader, VconLoadMeta, VconLoadResult } from '@vcon/core';
import * as fs from 'node:fs';

export class FsLoader implements VconLoader {
  readonly name = 'fs';
  load(result: VconLoadResult | undefined, meta: VconLoadMeta): void | VconLoadResult {
    if (result || meta.sourceType != 'fs') return result;

    if (fs.existsSync(meta.path)) {
      const content = fs.readFileSync(meta.path);

      return {
        content: content.toString('utf-8'),
      };
    }
  }
}
