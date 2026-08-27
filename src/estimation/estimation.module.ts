import { Module } from '@nestjs/common';
import { EstimationService } from './estimation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { HouseholdModule } from '../household/household.module';
import { PREDICTION_ENGINE } from './prediction-engine';
import { LlmModule } from '../llm/llm.module';
import { PredictionReasoner } from './prediction-reasoner.service';

@Module({
  imports: [PrismaModule, ProductModule, HouseholdModule, LlmModule],
  providers: [
    EstimationService,
    PredictionReasoner,
    {
      provide: PREDICTION_ENGINE,
      useExisting: EstimationService,
    },
  ],
  exports: [EstimationService, PREDICTION_ENGINE],
})
export class EstimationModule {}
