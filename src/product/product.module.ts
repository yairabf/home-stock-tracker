import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { LlmModule } from '../llm/llm.module';
import { ProductClassifier } from './product-classifier.service';
import { ProductClassificationLogService } from './product-classification-log.service';
import { ProductSearchService } from './product-search.service';
import { ProductResolutionService } from './product-resolution.service';
import { ProductResolutionLogService } from './product-resolution-log.service';

@Module({
  imports: [LlmModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductClassifier,
    ProductClassificationLogService,
    ProductSearchService,
    ProductResolutionLogService,
    ProductResolutionService,
  ],
  exports: [
    ProductService,
    ProductClassifier,
    ProductClassificationLogService,
    ProductSearchService,
    ProductResolutionLogService,
    ProductResolutionService,
  ],
})
export class ProductModule {}
