import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GroceryModule } from './grocery/grocery.module';
import { ProductModule } from './product/product.module';
import { InventoryModule } from './inventory/inventory.module';
import { HouseholdModule } from './household/household.module';
import { EstimationModule } from './estimation/estimation.module';
import { StatisticsModule } from './statistics/statistics.module';

@Module({
  imports: [PrismaModule, GroceryModule, ProductModule, InventoryModule, HouseholdModule, EstimationModule, StatisticsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
