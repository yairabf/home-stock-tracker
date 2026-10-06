import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { ProductNameKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  readShelfLifeContext,
  type ShelfLifePolicyInput,
  type ShelfLifePolicyResult,
} from './shelf-life-policy';
import { shelfLifeInferenceResultSchema } from './types/shelf-life-inference';

export const POLICY_PRODUCT_SELECT = {
  id: true,
  category: true,
  typicalUnit: true,
  productType: true,
  isPerishable: true,
  config: true,
  names: {
    where: { kind: ProductNameKind.canonical },
    select: { displayName: true },
    take: 1,
  },
} satisfies Prisma.ProductSelect;
export type PolicyProductSnapshot = Prisma.ProductGetPayload<{
  select: typeof POLICY_PRODUCT_SELECT;
}>;
export type PolicyWriteOutcome = 'applied' | 'stale' | 'reused' | 'unresolved';
const acceptedSchema = z.object({
  value: shelfLifeInferenceResultSchema,
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  taskVersion: z.string().trim().min(1),
});

export function policyInput(
  product: PolicyProductSnapshot,
): ShelfLifePolicyInput | null {
  const canonicalName = product.names[0]?.displayName;
  if (!canonicalName?.trim()) return null;
  return {
    productId: product.id,
    canonicalName,
    category: product.category,
    typicalUnit: product.typicalUnit,
    productType: product.productType,
    isPerishable: product.isPerishable,
    context: readShelfLifeContext(product.config),
  };
}

@Injectable()
export class ShelfLifePolicyWriter {
  constructor(private readonly prisma: PrismaService) {}

  async write(
    input: ShelfLifePolicyInput,
    result: ShelfLifePolicyResult,
    evaluatedAt: Date,
  ): Promise<PolicyWriteOutcome> {
    const parsed = acceptedSchema.safeParse(result);
    if (result.status !== 'resolved' || !parsed.success) return 'unresolved';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Lock evidence rows so a concurrent correction cannot commit between recheck and create.
            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = ${input.productId} FOR UPDATE`,
            );
            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "ProductName" WHERE "productId" = ${input.productId} AND "kind" = 'canonical' FOR UPDATE`,
            );
            const existing = await tx.productShelfLifePolicy.findUnique({
              where: { productId: input.productId },
            });
            if (existing) return 'reused';
            const current = await tx.product.findUnique({
              where: { id: input.productId },
              select: POLICY_PRODUCT_SELECT,
            });
            if (
              !current ||
              JSON.stringify(policyInput(current)) !== JSON.stringify(input)
            )
              return 'stale';
            await tx.productShelfLifePolicy.create({
              data: {
                productId: input.productId,
                ...parsed.data.value,
                modelProvider: parsed.data.provider,
                modelVersion: parsed.data.model,
                promptVersion: parsed.data.taskVersion,
                evaluatedAt,
              },
            });
            return 'applied';
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const code =
          error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : undefined;
        if (code === 'P2002' || code === 'P2034') {
          const existing = await this.prisma.productShelfLifePolicy.findUnique({
            where: { productId: input.productId },
          });
          if (existing) return 'reused';
          if (code === 'P2034' && attempt < 2) continue;
        }
        throw error;
      }
    }
    throw new Error('Policy write retry budget exhausted');
  }
}
