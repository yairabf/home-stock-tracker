import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductModule } from '../product/product.module';
import { EstimationModule } from '../estimation/estimation.module';
import { PredictionFeedbackService } from './prediction-feedback.service';

@Module({
  imports: [ProductModule, EstimationModule],
  controllers: [InventoryController],
  providers: [InventoryService, PredictionFeedbackService],
})
export class InventoryModule {}
