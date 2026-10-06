import { StockEvidenceService } from './stock-evidence.service';
import { Module } from '@nestjs/common';
import { EstimationService } from './estimation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { HouseholdModule } from '../household/household.module';
import { PREDICTION_ENGINE } from './prediction-engine';
import { LlmModule } from '../llm/llm.module';
import { PredictionReasoner } from './prediction-reasoner.service';
import { STOCK_PREDICTION_ADVISOR } from './stock-prediction-advisor';
import { JevStockPredictionAdvisor } from './jev-stock-prediction-advisor.service';
import { MODEL_CONFIG } from '../config/model-config.module';
import type { ModelConfig } from '../config/application-config';

@Module({
  imports: [PrismaModule, ProductModule, HouseholdModule, LlmModule],
  providers: [
    EstimationService,
    StockEvidenceService,
    PredictionReasoner,
    JevStockPredictionAdvisor,
    {
      provide: STOCK_PREDICTION_ADVISOR,
      useFactory: (
        config: ModelConfig,
        openai: PredictionReasoner,
        jev: JevStockPredictionAdvisor,
      ) => (config.stockPredictionProvider === 'typesafe' ? jev : openai),
      inject: [MODEL_CONFIG, PredictionReasoner, JevStockPredictionAdvisor],
    },
    {
      provide: PREDICTION_ENGINE,
      useExisting: EstimationService,
    },
  ],
  exports: [
    EstimationService,
    PREDICTION_ENGINE,
    StockEvidenceService,
    STOCK_PREDICTION_ADVISOR,
  ],
})
export class EstimationModule {}
