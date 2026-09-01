import type { ProductType } from '../../generated/prisma/enums';
import type {
  ProductSearchProduct,
  ProductSearchResult,
} from '../types/product-search';

export class ProductSearchProductResponseDto {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: string | null;
  typicalUnit: string | null;
  productType: ProductType | null;
  isPerishable: boolean;
  predictionEnabled: boolean;

  static fromContract(
    product: ProductSearchProduct,
  ): ProductSearchProductResponseDto {
    const dto = new ProductSearchProductResponseDto();
    dto.id = product.id;
    dto.canonicalName = product.canonicalName;
    dto.aliases = product.aliases;
    dto.category = product.category;
    dto.typicalUnit = product.typicalUnit;
    dto.productType = product.productType;
    dto.isPerishable = product.isPerishable;
    dto.predictionEnabled = product.predictionEnabled;
    return dto;
  }
}

export class ProductSearchResponseDto {
  exactMatch: ProductSearchProductResponseDto | null;
  candidates: ProductSearchProductResponseDto[];

  static fromContract(result: ProductSearchResult): ProductSearchResponseDto {
    const dto = new ProductSearchResponseDto();
    dto.exactMatch = result.exactMatch
      ? ProductSearchProductResponseDto.fromContract(result.exactMatch)
      : null;
    dto.candidates = result.candidates.map((candidate) =>
      ProductSearchProductResponseDto.fromContract(candidate),
    );
    return dto;
  }
}
