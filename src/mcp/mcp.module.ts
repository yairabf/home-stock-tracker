import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { GroceryModule } from '../grocery/grocery.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ObservabilityModule } from '../observability/observability.module';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [
    PrismaModule,
    GroceryModule,
    ProductModule,
    InventoryModule,
    ObservabilityModule,
    HouseholdModule,
  ],
  controllers: [McpController],
  providers: [McpServerFactory],
  exports: [McpServerFactory],
})
export class McpModule {}
