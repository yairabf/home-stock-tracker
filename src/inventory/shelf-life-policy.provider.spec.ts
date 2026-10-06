import { Test } from '@nestjs/testing';
import { MODEL_CONFIG } from '../config/model-config.module';
import { SHELF_LIFE_POLICY } from './shelf-life-policy';
import { OpenAiShelfLifePolicy } from './openai-shelf-life-policy.service';
import { JevShelfLifePolicy } from './jev-shelf-life-policy.service';
import { shelfLifePolicyProvider } from './shelf-life-policy.provider';

describe('shelf-life provider binding', () => {
  it.each([undefined, 'openai', 'typesafe'])(
    'independently selects %s',
    async (selector) => {
      const openai = { infer: jest.fn() },
        jev = { infer: jest.fn() };
      const module = await Test.createTestingModule({
        providers: [
          shelfLifePolicyProvider,
          {
            provide: MODEL_CONFIG,
            useValue: {
              shelfLifePolicyProvider: selector,
              productUnderstandingProvider: 'typesafe',
              stockPredictionProvider: 'openai',
            },
          },
          { provide: OpenAiShelfLifePolicy, useValue: openai },
          { provide: JevShelfLifePolicy, useValue: jev },
        ],
      }).compile();
      expect(module.get(SHELF_LIFE_POLICY)).toBe(
        selector === 'typesafe' ? jev : openai,
      );
      await module.close();
    },
  );
});
