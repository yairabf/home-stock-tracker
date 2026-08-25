import { Module } from '@nestjs/common';
import { GroceryController } from './grocery.controller';
import { GroceryService } from './grocery.service';

@Module({
  controllers: [GroceryController],
  providers: [GroceryService],
})
export class GroceryModule {}
