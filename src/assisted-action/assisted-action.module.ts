import { AssistedActionService } from './assisted-action.service';
import { AssistedActionController } from './assisted-action.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { AssistedStockService } from './assisted-stock.service';
import { Module } from '@nestjs/common';
import { GroceryModule } from '../grocery/grocery.module';
import { ProductModule } from '../product/product.module';
import { AssistedBatchPreparation } from './assisted-batch-preparation.service';
import { AssistedActionTransactions } from './assisted-action-transactions.service';
import { AssistedGroceryService } from './assisted-grocery.service';

@Module({
  imports: [GroceryModule, ProductModule, InventoryModule],
  controllers: [AssistedActionController],
  providers: [
    AssistedActionService,
    AssistedBatchPreparation,
    AssistedActionTransactions,
    AssistedGroceryService,
    AssistedStockService,
  ],
  exports: [
    AssistedActionService,
    AssistedGroceryService,
    AssistedStockService,
  ],
})
export class AssistedActionModule {}
