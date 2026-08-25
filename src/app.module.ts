import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { GroceryModule } from './grocery/grocery.module';

@Module({
  imports: [PrismaModule, GroceryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
