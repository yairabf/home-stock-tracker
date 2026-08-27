import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { GroceryModule } from '../grocery/grocery.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { EstimationModule } from '../estimation/estimation.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    PrismaModule,
    GroceryModule,
    ProductModule,
    EstimationModule,
    InventoryModule,
  ],
  controllers: [McpController],
  providers: [McpServerFactory],
  exports: [McpServerFactory],
})
export class McpModule {}
