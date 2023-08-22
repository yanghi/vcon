import { typeOf } from '../../utils';
import { PropertyType, JSONSchema } from '../schema';

export interface TransformMeta {
  value: any;
  type: JSONSchema['type'];
}

export type FunctionTransformer = Transformer['transform'];
export type TransformResult = { value: any };

export interface Transformer {
  transform(data: TransformMeta): TransformResult | void | Error;
  type: PropertyType;
  accept?: PropertyType[];
}

export const numberTransformer: Transformer = {
  type: 'number',
  accept: ['string', 'boolean', 'null'],
  transform(data) {
    if (typeof data.value === 'number') return;

    const num = Number(data.value);

    if (Number.isNaN(num)) {
      return new Error('Cannot convert to number');
    } else {
      return { value: num };
    }
  },
};

export const stringTransformer: Transformer = {
  type: 'string',
  transform: (data) => {
    return { value: data.value + '' };
  },
};

export const integerTransformer: Transformer = {
  type: 'integer',
  accept: ['string', 'number'],
  transform: (data) => {
    const num = Number(data.value);

    if (Number.isNaN(num)) {
      return new Error('Cannot convert to interger');
    }
    return { value: parseInt(num as any, 10) };
  },
};
export const booleanTransformer: Transformer = {
  type: 'boolean',
  transform: (data) => {
    return { value: !!data.value };
  },
};
export const arrayTransformer: Transformer = {
  type: 'array',
  transform: (data) => {
    if (Array.isArray(data.value)) return;

    return { value: [data.value] };
  },
};

export interface TrasnformerGroup {
  name?: string;
  transformers: Transformer[];
  ignoreCheck?: boolean;
}

export type TransformType = boolean | TrasnformerGroup | Transformer | Transformer[] | FunctionTransformer;

const basicTransformes = [numberTransformer, stringTransformer, integerTransformer, booleanTransformer];

export function canMatchType(source: JSONSchema['type'], expect: JSONSchema['type']): boolean {
  if (!expect) return false;

  const sourceArr = Array.isArray(source) ? source : [source];
  const expectArr = Array.isArray(expect) ? expect : [expect];

  return sourceArr.some((sourceType) => expectArr.includes(sourceType));
}

function inferPossibleTransformer(type: JSONSchema['type'], valueType: string): TrasnformerGroup | void {
  const types = Array.isArray(type) ? type : [type];

  const possibles = types.reduce((prev, targetType) => {
    const matched = basicTransformes.filter(
      (transformer) =>
        transformer.type === targetType && (!transformer.accept || transformer.accept.includes(valueType as any)),
    );
    prev.push(...matched);
    return prev;
  }, [] as Transformer[]);

  if (possibles.length) {
    return {
      name: 'possible',
      ignoreCheck: true,
      transformers: possibles,
    };
  }
}
function isTransformer(o: any): o is Transformer {
  return o && typeof o.transform === 'function';
}
export function transform(
  meta: TransformMeta,
  transformerType: TransformType | undefined,
): {
  value: any;
  errors?: Error[];
  transformed?: true;
} {
  if (!transformerType) return { value: meta.value };

  const result: ReturnType<typeof transform> = {
    value: meta.value,
  };

  if (transformerType === true) {
    let possibleTransformer = inferPossibleTransformer(meta.type, typeOf(meta.value));
    if (possibleTransformer) {
      return transform(meta, possibleTransformer);
    }

    return result;
  }

  const _transform = (fn: FunctionTransformer): boolean => {
    let transformResult = fn(meta);
    if (transformResult) {
      if (transformResult instanceof Error) {
        if (!result.errors) {
          result.errors = [];
        }

        result.errors.push(transformResult);

        return false;
      } else {
        result.value = transformResult.value;
        result.transformed = true;

        return true;
      }
    }
  };

  if (typeof transformerType === 'function') {
    _transform(transformerType);
    return result;
  } else if (Array.isArray(transformerType)) {
    for (let i = 0; i < transformerType.length; i++) {
      let transformer = transformerType[i];

      if (!transformer.accept || canMatchType(transformer.accept, meta.type)) {
        if (_transform(transformer.transform.bind(transformer))) {
          return result;
        }
      }
    }
  } else {
    if (isTransformer(transformerType)) {
      _transform(transformerType.transform);
      return result;
    } else {
      if (transformerType.ignoreCheck) {
        for (let i = 0; i < transformerType.transformers.length; i++) {
          let transformer = transformerType.transformers[i];

          if (_transform(transformer.transform.bind(transformer))) {
            return result;
          }
        }
      } else {
        for (let i = 0; i < transformerType.transformers.length; i++) {
          let transformer = transformerType.transformers[i];

          if (!transformer.accept || canMatchType(transformer.accept, meta.type)) {
            if (_transform(transformer.transform.bind(transformer))) {
              return result;
            }
          }
        }
      }
    }
  }

  return result;
}
