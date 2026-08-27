import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductModule } from '../product/product.module';
import { EstimationModule } from '../estimation/estimation.module';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { HouseholdModule } from '../household/household.module';
import { LowStockRecommendationService } from './low-stock-recommendation.service';

@Module({
  imports: [ProductModule, EstimationModule, HouseholdModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    PredictionFeedbackService,
    LowStockRecommendationService,
  ],
  exports: [InventoryService, LowStockRecommendationService],
})
export class InventoryModule {}
