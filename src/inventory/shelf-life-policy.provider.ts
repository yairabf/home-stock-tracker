import type { FactoryProvider } from '@nestjs/common';
import type { ModelConfig } from '../config/application-config';
import { MODEL_CONFIG } from '../config/model-config.module';
import { SHELF_LIFE_POLICY, type ShelfLifePolicy } from './shelf-life-policy';
import { OpenAiShelfLifePolicy } from './openai-shelf-life-policy.service';
import { JevShelfLifePolicy } from './jev-shelf-life-policy.service';

export const shelfLifePolicyProvider: FactoryProvider<ShelfLifePolicy> = {
  provide: SHELF_LIFE_POLICY,
  inject: [MODEL_CONFIG, OpenAiShelfLifePolicy, JevShelfLifePolicy],
  useFactory: (
    config: ModelConfig,
    openai: OpenAiShelfLifePolicy,
    jev: JevShelfLifePolicy,
  ) => (config.shelfLifePolicyProvider === 'typesafe' ? jev : openai),
};
