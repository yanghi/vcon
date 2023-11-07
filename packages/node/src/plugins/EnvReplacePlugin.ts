import { Vcon, VconPlugin } from '@vcon/core';

interface ParseResult {
  result: string;
  missingEnvs: string[];
  envs: string[];
}

function replace(str: string, provideValues: Record<any, any>): ParseResult {
  if (!str) return { result: str, envs: [], missingEnvs: [] };

  const missingEnvs: string[] = [];
  const envs: string[] = [];

  str = str.replace(/\$[a-zA-Z\_]+/g, ($1) => {
    var key = $1.slice(1);
    envs.push(key);

    if (provideValues[key] == undefined) {
      missingEnvs.push(key);
      return '';
    }

    return provideValues[key] || '';
  });

  return {
    result: str,
    missingEnvs,
    envs,
  };
}

export class EnvReplacePlugin implements VconPlugin {
  name = 'EnvReplacePlugin';
  setup(vcon: Vcon) {
    vcon.hooks.schema.parseValue.addHandler((result, metas) => {
      if (typeof result !== 'string') return;

      const withEnvChapter = result.indexOf('$') > -1;

      if (withEnvChapter) {
        const replaceResult = replace(result, process.env);

        if (replaceResult.missingEnvs.length) {
          if (replaceResult.missingEnvs.length == 1 && replaceResult.envs.length == 1) {
            if (metas.schema.default !== undefined) {
              return metas.schema.default;
            }
          } else if (vcon.getOptions().strict) {
            console.error(
              `[EnvReplacePlugin]: miss environment variables ${replaceResult.missingEnvs.join(',')} at ${
                metas.propertyPath
              }`,
            );
            process.exit(1);
          }
        }

        return replaceResult.result;
      }
    });
  }
}
