import { Module } from '@nestjs/common';
import { GroceryController } from './grocery.controller';
import { GroceryService } from './grocery.service';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [ProductModule],
  controllers: [GroceryController],
  providers: [GroceryService],
  exports: [GroceryService],
})
export class GroceryModule {}
