import type { ProductType } from '../../generated/prisma/enums';

export interface ExplicitProductCreationInput {
  canonicalName: string;
  aliases: string[];
  category: string;
  typicalUnit: string | null;
  productType: ProductType;
  isPerishable: boolean;
}
