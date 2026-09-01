import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ProductNameKind } from '../generated/prisma/enums';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import { OperationalLogger } from '../observability/operational-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddProductAliasDto } from './dto/add-product-alias.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { productNameConflict } from './product-name.exception';
import { normalizeProductName, toProductNameValue } from './product-name.util';
import { ProductClassificationLogService } from './product-classification-log.service';
import { ProductClassifier } from './product-classifier.service';
import type { ProductClassificationResult } from './types/product-classification';
import type { ExplicitProductCreationInput } from './types/explicit-product-creation';
import type { ProductNameValue } from './types/product-name';
import {
  PRODUCT_WITH_NAMES_ARGS,
  type ProductWithNames,
} from './types/product-with-names';

const SERIALIZATION_RETRIES = 3;

interface PreparedProductNames {
  canonical: ProductNameValue;
  aliases: ProductNameValue[];
}

interface ProductMetadata {
  category?: string;
  typicalUnit?: string | null;
  productType?: ProductClassificationResult['productType'];
  isPerishable?: boolean;
}

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productClassifier: ProductClassifier,
    private readonly classificationLog: ProductClassificationLogService,
    private readonly operationalLogger: OperationalLogger,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductWithNames> {
    const names = this.prepareProductNames(
      dto.canonicalName,
      dto.aliases,
      'canonicalName',
    );

    try {
      return await this.runSerializable((tx) =>
        this.createProductWithinTransaction(tx, names, {
          category: dto.category,
          typicalUnit: dto.typicalUnit,
        }),
      );
    } catch (error) {
      if (this.isProductNameWriteConflict(error)) {
        throw productNameConflict();
      }
      throw error;
    }
  }

  async findAll(): Promise<ProductWithNames[]> {
    return this.prisma.product.findMany(PRODUCT_WITH_NAMES_ARGS);
  }

  async findOne(id: string): Promise<ProductWithNames> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    if (!product) {
      throw new NotFoundException(`No product with id "${id}"`);
    }
    return product;
  }

  async findByExactOrAliasName(rawName: string): Promise<ProductWithNames> {
    const normalizedName = this.normalizeRequiredName(rawName, 'productName');
    const product = await this.findProductByNormalizedName(normalizedName);
    if (!product) {
      throw new NotFoundException(`No product named "${normalizedName}"`);
    }
    return product;
  }

  async findOrCreateExplicitWithinTransaction(
    tx: Prisma.TransactionClient,
    input: ExplicitProductCreationInput,
  ): Promise<ProductWithNames> {
    const names = this.prepareProductNames(
      input.canonicalName,
      input.aliases,
      'canonicalName',
    );
    const existing = await this.findProductByNormalizedNameWithinTransaction(
      tx,
      names.canonical.normalizedName,
    );
    if (existing) {
      return existing;
    }

    try {
      return await this.createProductWithinTransaction(tx, names, {
        category: input.category,
        typicalUnit: input.typicalUnit,
        productType: input.productType,
        isPerishable: input.isPerishable,
      });
    } catch (error) {
      if (this.isProductNameWriteConflict(error)) {
        throw productNameConflict();
      }
      throw error;
    }
  }

  async addAlias(
    id: string,
    dto: AddProductAliasDto,
  ): Promise<ProductWithNames> {
    const alias = this.requiredProductName(dto.alias, 'alias');

    try {
      return await this.runSerializable(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id },
          ...PRODUCT_WITH_NAMES_ARGS,
        });
        if (!product) {
          throw new NotFoundException(`No product with id "${id}"`);
        }

        return this.addAliasWithinTransaction(tx, product, alias);
      });
    } catch (error) {
      if (!this.isProductNameWriteConflict(error)) {
        throw error;
      }
      return this.resolveAliasWriteConflict(id, alias.normalizedName);
    }
  }

  async findOrCreateByExactOrAliasMatch(
    rawName: string,
  ): Promise<ProductWithNames> {
    const requestedName = this.requiredProductName(rawName, 'productName');
    const normalizedName = requestedName.normalizedName;
    const deterministicMatch =
      await this.findProductByNormalizedName(normalizedName);
    if (deterministicMatch) {
      return deterministicMatch;
    }

    const classification = await this.classifySafely(normalizedName);
    await this.recordClassificationSafely(classification);

    try {
      return await this.runSerializable(async (tx) => {
        const concurrentMatch =
          await this.findProductByNormalizedNameWithinTransaction(
            tx,
            normalizedName,
          );
        if (concurrentMatch) {
          return concurrentMatch;
        }

        if (classification.status === 'success') {
          const inferredMatch = await this.findByClassification(
            tx,
            classification.value,
          );
          if (inferredMatch) {
            return this.addAliasWithinTransaction(
              tx,
              inferredMatch,
              requestedName,
            );
          }

          const names = this.prepareProductNames(
            classification.value.canonicalName,
            [...classification.value.aliases, requestedName.displayName],
            'canonicalName',
          );
          return this.createProductWithinTransaction(tx, names, {
            category: classification.value.category,
            typicalUnit: classification.value.typicalUnit,
            productType: classification.value.productType,
            isPerishable: classification.value.isPerishable,
          });
        }

        const names = this.prepareProductNames(
          requestedName.displayName,
          undefined,
          'canonicalName',
        );
        return this.createProductWithinTransaction(tx, names, {});
      });
    } catch (error) {
      if (!this.isProductNameWriteConflict(error)) {
        throw error;
      }

      const concurrentMatch =
        await this.findProductByNormalizedName(normalizedName);
      if (concurrentMatch) {
        return concurrentMatch;
      }
      throw productNameConflict();
    }
  }

  private async classifySafely(
    normalizedName: string,
  ): Promise<LlmGenerationResult<ProductClassificationResult>> {
    try {
      return await this.productClassifier.classify({ rawName: normalizedName });
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async recordClassificationSafely(
    result: LlmGenerationResult<ProductClassificationResult>,
  ): Promise<void> {
    try {
      await this.classificationLog.record(result);
    } catch {
      // Classification logging is diagnostic and must not block product resolution.
    }
  }

  private async findByClassification(
    tx: Prisma.TransactionClient,
    classification: ProductClassificationResult,
  ): Promise<ProductWithNames | null> {
    const inferredNames = [
      classification.canonicalName,
      ...classification.aliases,
    ];
    for (const rawName of inferredNames) {
      const product = await this.findProductByNormalizedNameWithinTransaction(
        tx,
        normalizeProductName(rawName),
      );
      if (product) {
        return product;
      }
    }
    return null;
  }

  private async createProductWithinTransaction(
    tx: Prisma.TransactionClient,
    names: PreparedProductNames,
    metadata: ProductMetadata,
  ): Promise<ProductWithNames> {
    return tx.product.create({
      data: {
        ...metadata,
        names: {
          create: [
            {
              ...names.canonical,
              kind: ProductNameKind.canonical,
            },
            ...names.aliases.map((alias) => ({
              ...alias,
              kind: ProductNameKind.alias,
            })),
          ],
        },
      },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
  }

  private async addAliasWithinTransaction(
    tx: Prisma.TransactionClient,
    product: ProductWithNames,
    alias: ProductNameValue,
  ): Promise<ProductWithNames> {
    const owners = await tx.productName.findMany({
      where: { normalizedName: alias.normalizedName },
      select: { productId: true },
    });
    const ownerProductId = this.resolveUniqueProductId(
      owners,
      alias.normalizedName,
      'alias_write',
    );
    if (ownerProductId === product.id) {
      return product;
    }
    if (ownerProductId) {
      throw productNameConflict();
    }

    await tx.productName.create({
      data: {
        productId: product.id,
        ...alias,
        kind: ProductNameKind.alias,
      },
    });
    const updated = await tx.product.findUnique({
      where: { id: product.id },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    if (!updated) {
      throw new NotFoundException(`No product with id "${product.id}"`);
    }
    return updated;
  }

  private prepareProductNames(
    rawCanonicalName: string,
    rawAliases: string[] | undefined,
    fieldName: string,
  ): PreparedProductNames {
    const canonical = this.requiredProductName(rawCanonicalName, fieldName);
    const seen = new Set([canonical.normalizedName]);
    const aliases: ProductNameValue[] = [];

    for (const rawAlias of rawAliases ?? []) {
      const alias = toProductNameValue(rawAlias);
      if (!alias.normalizedName || seen.has(alias.normalizedName)) {
        continue;
      }
      seen.add(alias.normalizedName);
      aliases.push(alias);
    }

    return { canonical, aliases };
  }

  private requiredProductName(
    rawName: string,
    fieldName: string,
  ): ProductNameValue {
    const name = toProductNameValue(rawName);
    if (!name.normalizedName) {
      throw new BadRequestException(`${fieldName} must not be blank`);
    }
    return name;
  }

  private normalizeRequiredName(rawName: string, fieldName: string): string {
    return this.requiredProductName(rawName, fieldName).normalizedName;
  }

  private async resolveAliasWriteConflict(
    productId: string,
    normalizedName: string,
  ): Promise<ProductWithNames> {
    const owners = await this.prisma.productName.findMany({
      where: { normalizedName },
      select: { productId: true },
    });
    const ownerProductId = this.resolveUniqueProductId(
      owners,
      normalizedName,
      'alias_write',
    );
    if (ownerProductId !== productId) {
      throw productNameConflict();
    }
    return this.findOne(productId);
  }

  private async findProductByNormalizedName(
    normalizedName: string,
  ): Promise<ProductWithNames | null> {
    const owners = await this.prisma.productName.findMany({
      where: { normalizedName },
      select: { productId: true },
    });
    this.resolveUniqueProductId(owners, normalizedName, 'lookup');
    const owner = await this.prisma.productName.findUnique({
      where: { normalizedName },
      include: { product: PRODUCT_WITH_NAMES_ARGS },
    });
    return owner?.product ?? null;
  }

  private async findProductByNormalizedNameWithinTransaction(
    tx: Prisma.TransactionClient,
    normalizedName: string,
  ): Promise<ProductWithNames | null> {
    const owners = await tx.productName.findMany({
      where: { normalizedName },
      select: { productId: true },
    });
    this.resolveUniqueProductId(owners, normalizedName, 'lookup');
    const owner = await tx.productName.findUnique({
      where: { normalizedName },
      include: { product: PRODUCT_WITH_NAMES_ARGS },
    });
    return owner?.product ?? null;
  }

  private resolveUniqueProductId(
    owners: Array<{ productId: string }>,
    normalizedName: string,
    action: 'lookup' | 'alias_write',
  ): string | null {
    const productIds = [...new Set(owners.map(({ productId }) => productId))];
    if (productIds.length > 1) {
      this.operationalLogger.catalogIntegrity({
        outcome: 'failure',
        action,
        productIds: productIds.sort(),
        normalizedNameFingerprint: this.fingerprintName(normalizedName),
        ownerCount: productIds.length,
        errorType: 'multiple_name_owners',
      });
      throw productNameConflict();
    }
    return productIds[0] ?? null;
  }

  private fingerprintName(normalizedName: string): string {
    const digest = createHash('sha256').update(normalizedName).digest('hex');
    return `sha256:${digest.slice(0, 16)}`;
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !this.isSerializationConflict(error) ||
          attempt === SERIALIZATION_RETRIES
        ) {
          throw error;
        }
      }
    }

    throw new Error('Serializable transaction retries exhausted');
  }

  private isProductNameWriteConflict(error: unknown): boolean {
    return (
      this.isPrismaError(error, 'P2002') || this.isSerializationConflict(error)
    );
  }

  private isSerializationConflict(error: unknown): boolean {
    return this.isPrismaError(error, 'P2034');
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }
}
