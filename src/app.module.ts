import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GroceryModule } from './grocery/grocery.module';
import { ProductModule } from './product/product.module';
import { InventoryModule } from './inventory/inventory.module';

@Module({
  imports: [PrismaModule, GroceryModule, ProductModule, InventoryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
