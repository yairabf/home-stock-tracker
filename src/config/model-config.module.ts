import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { ModelConfig } from './application-config';

export const MODEL_CONFIG = Symbol('MODEL_CONFIG');

@Global()
@Module({})
export class ModelConfigModule {
  static register(config: ModelConfig): DynamicModule {
    return {
      module: ModelConfigModule,
      providers: [{ provide: MODEL_CONFIG, useValue: config }],
      exports: [MODEL_CONFIG],
    };
  }
}
