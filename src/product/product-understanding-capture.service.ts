import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ModelConfig } from '../config/application-config';
import { MODEL_CONFIG } from '../config/model-config.module';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductUnderstandingInput } from './product-understanding';

@Injectable()
export class ProductUnderstandingCaptureService {
  private readonly logger = new Logger(ProductUnderstandingCaptureService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MODEL_CONFIG) private readonly config: ModelConfig,
  ) {}

  async record(input: ProductUnderstandingInput): Promise<void> {
    if (!this.config.productUnderstandingCaptureEnabled) return;
    try {
      const id = randomUUID();
      const capturedAt = new Date();
      const snapshot = JSON.parse(
        JSON.stringify({
          version: 'product-understanding-input-capture-v1',
          captureId: id,
          capturedAt: capturedAt.toISOString(),
          capturePhase: 'before_inference',
          input,
        }),
      ) as Prisma.InputJsonValue;
      await this.prisma.llmInferenceLog.create({
        data: {
          id,
          modelProvider: 'input_capture',
          modelVersion: 'not_applicable',
          promptVersion: 'product-understanding-input-capture-v1',
          timestamp: capturedAt,
          structuredResponse: snapshot,
        },
      });
    } catch {
      this.logger.warn('Product understanding input capture was not saved');
    }
  }
}
