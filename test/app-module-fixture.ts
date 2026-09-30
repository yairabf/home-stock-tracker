import { AppModule } from '../src/app.module';
import type { ModelConfig } from '../src/config/application-config';
import { DEFAULT_OPENAI_MODEL } from '../src/llm/openai/openai.tokens';

export const TEST_MODEL_CONFIG: ModelConfig = {
  llmProvider: 'openai',
  llmModel: DEFAULT_OPENAI_MODEL,
  productResolutionProvider: 'openai',
  stockPredictionProvider: 'openai',
};

export const TEST_APP_MODULE = AppModule.register(TEST_MODEL_CONFIG);
