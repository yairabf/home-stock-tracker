import type { ExpirationBatchModel } from '../../generated/prisma/models';

export class ExpirationBatchResponseDto {
  id: string;
  productId: string;
  purchaseEventId: string;
  expiresAt: Date;
  recordedAt: Date;
  source: string;

  static fromEntity(entity: ExpirationBatchModel): ExpirationBatchResponseDto {
    return Object.assign(new ExpirationBatchResponseDto(), entity);
  }
}
