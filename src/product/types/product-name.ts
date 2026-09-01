export const PRODUCT_NAME_KINDS = ['canonical', 'alias'] as const;

export type ProductNameKind = (typeof PRODUCT_NAME_KINDS)[number];

export interface ProductNameValue {
  displayName: string;
  normalizedName: string;
}

export interface ProductNameContract extends ProductNameValue {
  kind: ProductNameKind;
}
