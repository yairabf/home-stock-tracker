import type { ProductType } from '../../generated/prisma/enums';
import {
  getCanonicalProductName,
  getProductAliases,
  type ProductWithNames,
} from '../types/product-with-names';

export class ProductResponseDto {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: string | null;
  typicalUnit: string | null;
  productType: ProductType | null;
  isPerishable: boolean;
  predictionStrategy: string | null;
  predictionEnabled: boolean;
  config: unknown;

  static fromEntity(product: ProductWithNames): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.canonicalName = getCanonicalProductName(product);
    dto.aliases = getProductAliases(product);
    dto.category = product.category;
    dto.typicalUnit = product.typicalUnit;
    dto.productType = product.productType;
    dto.isPerishable = product.isPerishable;
    dto.predictionStrategy = product.predictionStrategy;
    dto.predictionEnabled = product.predictionEnabled;
    dto.config = product.config;
    return dto;
  }
}
