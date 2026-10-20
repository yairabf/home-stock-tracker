import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductSearchService } from '../product/product-search.service';
import { ProductUnderstandingRunner } from '../product/product-understanding-runner.service';
import { normalizeProductName } from '../product/product-name.util';
import { PRODUCT_WITH_NAMES_ARGS } from '../product/types/product-with-names';
import {
  toProductSearchProduct,
  type ProductSearchProduct,
} from '../product/types/product-search';
import {
  acceptedMetadata,
  metadataSnapshot,
  UNDERSTANDING_FIELDS,
  type ProductMetadataSnapshot,
} from '../product/product-understanding';
import type { AssistedActionRequest } from './assisted-action-request';
import { AssistedIdentityNormalizer } from './assisted-identity-normalizer.service';
import {
  PreparationDeadline,
  remainingPreparationMs,
  withinPreparationDeadline,
  type CatalogPreparationResult,
  type IdentityEvidence,
} from './assisted-preparation';

type Item = AssistedActionRequest['items'][number];
const emptyMetadata: ProductMetadataSnapshot = {
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: null,
};

@Injectable()
export class AssistedCatalogPreparation {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: ProductSearchService,
    private readonly normalizer: AssistedIdentityNormalizer,
    private readonly understanding: ProductUnderstandingRunner,
  ) {}

  async prepare(
    item: Item,
    expiresAt: number,
  ): Promise<CatalogPreparationResult> {
    try {
      return await withinPreparationDeadline(expiresAt, () =>
        this.prepareItem(item, expiresAt),
      );
    } catch (error) {
      if (error instanceof PreparationDeadline)
        return {
          outcome: 'unavailable',
          code: 'provider_deadline',
          retryable: true,
        };
      throw error;
    }
  }

  private async prepareItem(
    item: Item,
    expiresAt: number,
  ): Promise<CatalogPreparationResult> {
    let existing = await this.findExact(item);
    remainingPreparationMs(expiresAt);
    if (item.productId && !existing)
      return {
        outcome: 'needs_input',
        code: 'ambiguous_product',
        candidates: [],
      };
    let canonicalName = existing?.canonicalName;
    let evidence: IdentityEvidence | null = null;
    if (!existing) {
      // Discovery has a 200-character limit; exact lookup and AI retain the full phrase.
      const discovery = await this.search.search({
        query: [...normalizeProductName(item.productName!)]
          .slice(0, 200)
          .join(''),
        limit: 20,
      });
      remainingPreparationMs(expiresAt);
      const candidates = discovery.exactMatch
        ? [discovery.exactMatch]
        : discovery.candidates;
      const result = await this.normalizer.normalize(
        item.productName!,
        candidates,
        expiresAt,
      );
      if (result.outcome !== 'resolved') return result;
      remainingPreparationMs(expiresAt);
      evidence = result.evidence;
      const decision = result.decision;
      existing =
        decision.outcome === 'existing'
          ? (candidates.find((p) => p.id === decision.productId) ?? null)
          : await this.findName(decision.canonicalName);
      canonicalName =
        existing?.canonicalName ??
        (result.decision.outcome === 'new'
          ? result.decision.canonicalName
          : undefined);
    }
    remainingPreparationMs(expiresAt);
    if (!canonicalName)
      return { outcome: 'needs_input', code: 'ambiguous_product' };
    return this.enrich(item, existing, canonicalName, evidence, expiresAt);
  }

  private async enrich(
    item: Item,
    existing: ProductSearchProduct | null,
    canonicalName: string,
    evidence: IdentityEvidence | null,
    expiresAt: number,
  ): Promise<CatalogPreparationResult> {
    const metadata = existing
      ? metadataSnapshot(existing)
      : { ...emptyMetadata };
    for (const field of UNDERSTANDING_FIELDS) {
      const supplied = item.metadata?.[field];
      if (supplied == null) continue;
      if (metadata[field] !== null && metadata[field] !== supplied)
        return { outcome: 'needs_input', code: 'metadata_conflict' };
      Object.assign(metadata, { [field]: supplied });
    }
    remainingPreparationMs(expiresAt);
    // Version the evidence envelope without changing existing classifier routes/prompts.
    const inputEvidence = JSON.stringify({
      version: 'assisted-product-evidence-v1',
      canonicalName,
      originalName: item.productName ?? null,
    });
    const understanding = Object.values(metadata).some(
      (value) => value === null,
    )
      ? await withinPreparationDeadline(expiresAt, () =>
          this.understanding.understand(inputEvidence, metadata),
        )
      : null;
    remainingPreparationMs(expiresAt);
    const suppliedName = item.productName ?? null;
    const knownNames = existing
      ? [existing.canonicalName, ...existing.aliases]
      : [canonicalName];
    const aliasToAdd =
      suppliedName &&
      !knownNames.some(
        (name) =>
          normalizeProductName(name) === normalizeProductName(suppliedName),
      )
        ? suppliedName
        : null;
    return {
      outcome: 'prepared',
      product: {
        suppliedName,
        canonicalName,
        aliasToAdd,
        existing,
        metadata: {
          ...metadata,
          ...(understanding ? acceptedMetadata(metadata, understanding) : {}),
        },
        identityEvidence: evidence,
        understanding,
      },
    };
  }

  private async findExact(item: Item): Promise<ProductSearchProduct | null> {
    if (!item.productId) return this.findName(item.productName!);
    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    return product ? toProductSearchProduct(product) : null;
  }

  private async findName(name: string): Promise<ProductSearchProduct | null> {
    const owner = await this.prisma.productName.findUnique({
      where: { normalizedName: normalizeProductName(name) },
      include: { product: PRODUCT_WITH_NAMES_ARGS },
    });
    return owner ? toProductSearchProduct(owner.product) : null;
  }
}
