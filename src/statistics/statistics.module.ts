import { Module } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [PrismaModule, ProductModule, HouseholdModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
