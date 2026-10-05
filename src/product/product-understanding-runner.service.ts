import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_UNDERSTANDING,
  initialUnderstanding,
  type ProductMetadataSnapshot,
  type ProductUnderstanding,
  type ProductUnderstandingResult,
} from './product-understanding';

@Injectable()
export class ProductUnderstandingRunner {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_UNDERSTANDING)
    private readonly adapter: ProductUnderstanding,
  ) {}

  async understand(
    rawName: string,
    metadata: ProductMetadataSnapshot,
  ): Promise<ProductUnderstandingResult> {
    if (Object.values(metadata).every((value) => value !== null))
      return initialUnderstanding(metadata);
    try {
      const [categories, units] = await Promise.all([
        this.prisma.product.findMany({
          where: { category: { not: null } },
          select: { category: true },
          distinct: ['category'],
        }),
        this.prisma.product.findMany({
          where: { typicalUnit: { not: null } },
          select: { typicalUnit: true },
          distinct: ['typicalUnit'],
        }),
      ]);
      return await this.adapter.understand({
        rawName,
        metadata,
        categories: categories.map((row) => row.category).filter(nonblank),
        units: units.map((row) => row.typicalUnit).filter(nonblank),
      });
    } catch {
      return initialUnderstanding(metadata);
    }
  }
}
function nonblank(value: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
