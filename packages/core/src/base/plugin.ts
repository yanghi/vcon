import { Vcon } from './vcon';

export interface VconPlugin {
  readonly name: string;
  setup(vcon: Vcon): void;
}
