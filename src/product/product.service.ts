import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeAliases, normalizeProductName } from './product-name.util';
import { CreateProductDto } from './dto/create-product.dto';
import { AddProductAliasDto } from './dto/add-product-alias.dto';
import type { ProductModel } from '../generated/prisma/models';

const SERIALIZATION_RETRIES = 3;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto): Promise<ProductModel> {
    const canonicalName = this.normalizeRequiredName(
      dto.canonicalName,
      'canonicalName',
    );

    return this.runSerializable(async (tx) => {
      const products = await tx.product.findMany();
      if (this.findByCanonicalName(products, canonicalName)) {
        throw new ConflictException(
          `A product named "${canonicalName}" already exists`,
        );
      }

      return tx.product.create({
        data: {
          canonicalName,
          aliases: normalizeAliases(dto.aliases, canonicalName),
          category: dto.category,
          typicalUnit: dto.typicalUnit,
        },
      });
    });
  }

  async findAll(): Promise<ProductModel[]> {
    return this.prisma.product.findMany();
  }

  async findOne(id: string): Promise<ProductModel> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException(`No product with id "${id}"`);
    }
    return product;
  }

  async addAlias(id: string, dto: AddProductAliasDto): Promise<ProductModel> {
    const alias = this.normalizeRequiredName(dto.alias, 'alias');

    return this.runSerializable(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) {
        throw new NotFoundException(`No product with id "${id}"`);
      }

      if (this.hasNormalizedName(product, alias)) {
        throw new ConflictException(
          `Product "${product.canonicalName}" already has the alias "${alias}"`,
        );
      }

      return tx.product.update({
        where: { id },
        data: { aliases: [...product.aliases, alias] },
      });
    });
  }

  async findOrCreateByExactOrAliasMatch(
    rawName: string,
  ): Promise<ProductModel> {
    const normalizedName = this.normalizeRequiredName(rawName, 'productName');

    return this.runSerializable(async (tx) => {
      const products = await tx.product.findMany();
      const existing = this.findByExactOrAlias(products, normalizedName);
      if (existing) {
        return existing;
      }

      return tx.product.create({ data: { canonicalName: normalizedName } });
    });
  }

  private normalizeRequiredName(rawName: string, fieldName: string): string {
    const normalizedName = normalizeProductName(rawName);
    if (!normalizedName) {
      throw new BadRequestException(`${fieldName} must not be blank`);
    }
    return normalizedName;
  }

  private findByCanonicalName(
    products: ProductModel[],
    canonicalName: string,
  ): ProductModel | undefined {
    return products.find(
      (product) =>
        normalizeProductName(product.canonicalName) === canonicalName,
    );
  }

  private findByExactOrAlias(
    products: ProductModel[],
    name: string,
  ): ProductModel | undefined {
    return products.find((product) => this.hasNormalizedName(product, name));
  }

  private hasNormalizedName(product: ProductModel, name: string): boolean {
    return (
      normalizeProductName(product.canonicalName) === name ||
      product.aliases.some((alias) => normalizeProductName(alias) === name)
    );
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

  private isSerializationConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
