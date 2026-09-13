import type { ShelfLifePolicyKind } from '../../generated/prisma/enums';
import {
  evaluateExpirationStatus,
  type ExpirationStatus,
  type ExpirySource,
} from '../expiration-status';

export interface ExpirationStatusReadEntity {
  id: string;
  productId: string;
  timestamp: Date;
  expirationBatch: { expiresAt: Date } | null;
  product: {
    names: Array<{ displayName: string }>;
    shelfLifePolicy: {
      kind: ShelfLifePolicyKind;
      shelfLifeDays: number | null;
    } | null;
  };
}

export class ExpirationStatusItemResponseDto {
  purchaseEventId: string;
  productId: string;
  productName: string;
  purchasedAt: Date;
  expiresAt: Date | null;
  status: ExpirationStatus;
  expirySource: ExpirySource;
  shelfLifeDays: number | null;
  evaluatedAt: Date;

  static fromEntity(
    entity: ExpirationStatusReadEntity,
    evaluatedAt: Date,
  ): ExpirationStatusItemResponseDto {
    const evaluation = evaluateExpirationStatus({
      purchasedAt: entity.timestamp,
      explicitExpiresAt: entity.expirationBatch?.expiresAt ?? null,
      shelfLifePolicy: entity.product.shelfLifePolicy,
      asOf: evaluatedAt,
    });
    return Object.assign(new ExpirationStatusItemResponseDto(), {
      purchaseEventId: entity.id,
      productId: entity.productId,
      productName: entity.product.names[0]?.displayName ?? '',
      purchasedAt: entity.timestamp,
      ...evaluation,
      evaluatedAt,
    });
  }
}

export class ExpirationStatusListResponseDto {
  items: ExpirationStatusItemResponseDto[];
}
