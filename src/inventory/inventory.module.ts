import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductModule } from '../product/product.module';
import { EstimationModule } from '../estimation/estimation.module';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { HouseholdModule } from '../household/household.module';
import { LowStockRecommendationService } from './low-stock-recommendation.service';
import { StockLedgerService } from './stock-ledger.service';
import { StatisticsModule } from '../statistics/statistics.module';
import { StockMaterializationService } from './stock-materialization.service';

@Module({
  imports: [ProductModule, EstimationModule, HouseholdModule, StatisticsModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    PredictionFeedbackService,
    LowStockRecommendationService,
    StockLedgerService,
    StockMaterializationService,
  ],
  exports: [
    InventoryService,
    PredictionFeedbackService,
    LowStockRecommendationService,
    StockLedgerService,
  ],
})
export class InventoryModule {}
