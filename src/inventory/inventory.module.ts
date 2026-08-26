import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProductModule } from '../product/product.module';
import { EstimationModule } from '../estimation/estimation.module';

@Module({
  imports: [ProductModule, EstimationModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
