import type {
  ProductResolutionContext,
  ProductResolutionProposal,
} from './types/product-resolution';

export const PRODUCT_RESOLUTION_ADVISOR = Symbol('PRODUCT_RESOLUTION_ADVISOR');

export type ProductResolutionAdviceResult =
  | {
      status: 'success';
      value: ProductResolutionProposal;
      provider: string;
      model: string;
      taskVersion: string;
    }
  | { status: 'unavailable' };

export interface ProductResolutionAdvisor {
  advise(
    context: ProductResolutionContext,
  ): Promise<ProductResolutionAdviceResult>;
}
