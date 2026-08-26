import { Module } from '@nestjs/common';
import { EstimationService } from './estimation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [PrismaModule, ProductModule, HouseholdModule],
  providers: [EstimationService],
  exports: [EstimationService],
})
export class EstimationModule {}
