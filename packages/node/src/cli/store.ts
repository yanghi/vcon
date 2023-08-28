import * as fs from 'fs';

export interface VconProject {
  path: string;
  sources: {
    config: any;
    loadOptions: any;
  }[];
  configs: [];
}
