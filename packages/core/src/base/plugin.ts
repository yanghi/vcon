import { Vcon, VconNormalizedOptions } from './vcon';

export interface VconPlugin {
  readonly name: string;
  setup(vcon: Vcon, vconOptions: VconNormalizedOptions): void;
}
