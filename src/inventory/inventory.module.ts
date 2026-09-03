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
import { LlmModule } from '../llm/llm.module';
import { ShelfLifeReasoner } from './shelf-life-reasoner.service';
import { ShelfLifeInferenceService } from './shelf-life-inference.service';
import { DailyStockMaterializationService } from './daily-stock-materialization.service';
import {
  STOCK_WORKFLOW_CONFIG,
  loadStockWorkflowConfig,
} from '../config/application-config';
import { DailyStockWorkflowService } from './daily-stock-workflow.service';
import { StockWorkflowSchedulerService } from './stock-workflow-scheduler.service';

@Module({
  imports: [
    ProductModule,
    EstimationModule,
    HouseholdModule,
    StatisticsModule,
    LlmModule,
  ],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    PredictionFeedbackService,
    LowStockRecommendationService,
    StockLedgerService,
    StockMaterializationService,
    ShelfLifeReasoner,
    ShelfLifeInferenceService,
    DailyStockMaterializationService,
    DailyStockWorkflowService,
    StockWorkflowSchedulerService,
    {
      provide: STOCK_WORKFLOW_CONFIG,
      useFactory: loadStockWorkflowConfig,
    },
  ],
  exports: [
    InventoryService,
    PredictionFeedbackService,
    LowStockRecommendationService,
    StockLedgerService,
  ],
})
export class InventoryModule {}
