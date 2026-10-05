import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductUnderstandingRunner } from './product-understanding-runner.service';
import { ProductUnderstandingLogService } from './product-understanding-log.service';
import {
  acceptedMetadata,
  metadataSnapshot,
  type ProductMetadataSnapshot,
  type UnderstandingField,
} from './product-understanding';
import {
  getCanonicalProductName,
  PRODUCT_WITH_NAMES_ARGS,
  type ProductWithNames,
} from './types/product-with-names';

@Injectable()
export class ProductEnrichmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ProductUnderstandingRunner,
    private readonly logs: ProductUnderstandingLogService,
  ) {}

  async enrich(id: string): Promise<ProductWithNames> {
    const snapshot = await this.findOne(id);
    const metadata = metadataSnapshot(snapshot);
    if (Object.values(metadata).every((value) => value !== null))
      return snapshot;
    const result = await this.runner.understand(
      getCanonicalProductName(snapshot),
      metadata,
    );
    const update = acceptedMetadata(metadata, result);
    const applied =
      Object.keys(update).length > 0
        ? await this.applySnapshot(snapshot, update)
        : false;
    const product = await this.findOne(id);
    await this.logs.record(
      result,
      applied ? (Object.keys(update) as UnderstandingField[]) : [],
      applied ? 'applied' : Object.keys(update).length ? 'stale' : 'unresolved',
    );
    return product;
  }

  private async applySnapshot(
    snapshot: ProductWithNames,
    update: Partial<ProductMetadataSnapshot>,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const current = await tx.product.findUnique({
              where: { id: snapshot.id },
              ...PRODUCT_WITH_NAMES_ARGS,
            });
            if (!current)
              throw new NotFoundException(
                `No product with id "${snapshot.id}"`,
              );
            if (snapshotKey(current) !== snapshotKey(snapshot)) return false;
            const saved = await tx.product.updateMany({
              where: {
                id: snapshot.id,
                ...metadataSnapshot(snapshot),
                names: {
                  every: {
                    OR: snapshot.names.map(
                      ({ id, displayName, normalizedName, kind }) => ({
                        id,
                        displayName,
                        normalizedName,
                        kind,
                      }),
                    ),
                  },
                },
              },
              data: update,
            });
            return saved.count === 1;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt === 2
        )
          throw error;
      }
    }
    return false;
  }

  private async findOne(id: string): Promise<ProductWithNames> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    if (!product) throw new NotFoundException(`No product with id "${id}"`);
    return product;
  }
}

function snapshotKey(product: ProductWithNames): string {
  return JSON.stringify({
    metadata: metadataSnapshot(product),
    names: product.names
      .map(({ id, displayName, normalizedName, kind }) => ({
        id,
        displayName,
        normalizedName,
        kind,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
