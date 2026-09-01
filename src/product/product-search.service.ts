import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  productSearchInputSchema,
  toProductSearchProduct,
  type ProductSearchRequest,
  type ProductSearchResult,
} from './types/product-search';
import {
  PRODUCT_WITH_NAMES_ARGS,
  type ProductWithNames,
} from './types/product-with-names';

interface RankedProductId {
  productId: string;
}

@Injectable()
export class ProductSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: ProductSearchRequest): Promise<ProductSearchResult> {
    const { query, limit } = productSearchInputSchema.parse(input);
    return this.prisma.$transaction(
      (tx) => this.searchWithinSnapshot(tx, query, limit),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async searchWithinSnapshot(
    tx: Prisma.TransactionClient,
    query: string,
    limit: number,
  ): Promise<ProductSearchResult> {
    const exactOwner = await tx.productName.findUnique({
      where: { normalizedName: query },
      include: { product: PRODUCT_WITH_NAMES_ARGS },
    });

    if (exactOwner) {
      return {
        exactMatch: toProductSearchProduct(exactOwner.product),
        candidates: [],
      };
    }

    const rankedIds = await this.findRankedProductIds(tx, query, limit);
    if (rankedIds.length === 0) {
      return { exactMatch: null, candidates: [] };
    }

    const products = await tx.product.findMany({
      where: { id: { in: rankedIds.map(({ productId }) => productId) } },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    const productsById = new Map(
      products.map((product) => [product.id, product] as const),
    );

    return {
      exactMatch: null,
      candidates: rankedIds
        .map(({ productId }) => productsById.get(productId))
        .filter((product): product is ProductWithNames => Boolean(product))
        .map(toProductSearchProduct),
    };
  }

  private findRankedProductIds(
    tx: Prisma.TransactionClient,
    normalizedQuery: string,
    limit: number,
  ): Promise<RankedProductId[]> {
    return tx.$queryRaw<RankedProductId[]>(Prisma.sql`
      WITH query_tokens AS (
        SELECT regexp_split_to_array(${normalizedQuery}, ' ') AS tokens
      ),
      matched_names AS (
        SELECT
          pn."productId",
          pn."normalizedName",
          pn."kind",
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM query_tokens qt
              CROSS JOIN LATERAL (
                SELECT regexp_split_to_array(pn."normalizedName", ' ') AS tokens
              ) name
              CROSS JOIN LATERAL generate_series(
                1,
                cardinality(name.tokens) - cardinality(qt.tokens) + 1
              ) start_index
              WHERE (
                SELECT bool_and(
                  name.tokens[start_index + token_index - 1]
                    ^@ qt.tokens[token_index]
                )
                FROM generate_subscripts(qt.tokens, 1) token_index
              )
            ) THEN CASE WHEN pn."kind" = 'canonical' THEN 0 ELSE 1 END
            WHEN position(${normalizedQuery} in pn."normalizedName") > 0
              THEN CASE WHEN pn."kind" = 'canonical' THEN 2 ELSE 3 END
            ELSE NULL
          END AS match_rank
        FROM "ProductName" pn
      ),
      best_names AS (
        SELECT DISTINCT ON ("productId")
          "productId",
          match_rank,
          char_length("normalizedName") AS name_length,
          "normalizedName"
        FROM matched_names
        WHERE match_rank IS NOT NULL
        ORDER BY
          "productId",
          match_rank,
          char_length("normalizedName"),
          "normalizedName" COLLATE "C"
      )
      SELECT "productId"
      FROM best_names
      ORDER BY
        match_rank,
        name_length,
        "normalizedName" COLLATE "C",
        "productId" COLLATE "C"
      LIMIT ${limit}
    `);
  }
}
