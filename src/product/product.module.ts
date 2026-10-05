import { EmptyEnrichmentBodyPipe } from './empty-enrichment-body.pipe';
import { ProductEnrichmentService } from './product-enrichment.service';
import { ProductUnderstandingRunner } from './product-understanding-runner.service';
import { ProductUnderstandingLogService } from './product-understanding-log.service';
import { PRODUCT_UNDERSTANDING } from './product-understanding';
import { JevProductUnderstanding } from './jev-product-understanding.service';
import { OpenAiProductUnderstanding } from './openai-product-understanding.service';
import { MODEL_CONFIG } from '../config/model-config.module';
import type { ModelConfig } from '../config/application-config';
import { JevProductResolutionAdvisor } from './jev-product-resolution-advisor.service';
import { PRODUCT_RESOLUTION_ADVISOR } from './product-resolution-advisor';
import { OpenAiProductResolutionAdvisor } from './openai-product-resolution-advisor.service';
import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { LlmModule } from '../llm/llm.module';
import { ProductSearchService } from './product-search.service';
import { ProductResolutionService } from './product-resolution.service';
import { ProductResolutionLogService } from './product-resolution-log.service';

@Module({
  imports: [LlmModule],
  controllers: [ProductController],
  providers: [
    EmptyEnrichmentBodyPipe,
    ProductEnrichmentService,
    ProductUnderstandingRunner,
    ProductUnderstandingLogService,
    OpenAiProductUnderstanding,
    JevProductUnderstanding,
    {
      provide: PRODUCT_UNDERSTANDING,
      useFactory: (
        config: ModelConfig,
        openai: OpenAiProductUnderstanding,
        jev: JevProductUnderstanding,
      ) => (config.productUnderstandingProvider === 'typesafe' ? jev : openai),
      inject: [
        MODEL_CONFIG,
        OpenAiProductUnderstanding,
        JevProductUnderstanding,
      ],
    },
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
    ProductSearchService,
    ProductResolutionLogService,
    ProductResolutionService,
  ],
  exports: [
    ProductEnrichmentService,
    PRODUCT_UNDERSTANDING,
    ProductService,
    ProductSearchService,
    ProductResolutionLogService,
    ProductResolutionService,
  ],
})
export class ProductModule {}
