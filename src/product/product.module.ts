import { MODEL_CONFIG } from '../config/model-config.module';
import type { ModelConfig } from '../config/application-config';
import { JevProductResolutionAdvisor } from './jev-product-resolution-advisor.service';
import { PRODUCT_RESOLUTION_ADVISOR } from './product-resolution-advisor';
import { OpenAiProductResolutionAdvisor } from './openai-product-resolution-advisor.service';
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
    OpenAiProductResolutionAdvisor,
    JevProductResolutionAdvisor,
    {
      provide: PRODUCT_RESOLUTION_ADVISOR,
      useFactory: (
        config: ModelConfig,
        openai: OpenAiProductResolutionAdvisor,
        jev: JevProductResolutionAdvisor,
      ) => (config.productResolutionProvider === 'typesafe' ? jev : openai),
      inject: [
        MODEL_CONFIG,
        OpenAiProductResolutionAdvisor,
        JevProductResolutionAdvisor,
      ],
    },
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
