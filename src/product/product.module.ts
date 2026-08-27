import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { LlmModule } from '../llm/llm.module';
import { ProductClassifier } from './product-classifier.service';
import { ProductClassificationLogService } from './product-classification-log.service';

@Module({
  imports: [LlmModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductClassifier,
    ProductClassificationLogService,
  ],
  exports: [ProductService, ProductClassifier, ProductClassificationLogService],
})
export class ProductModule {}
