import type { GroceryItemSource } from '../../generated/prisma/enums';
import type { ExplicitProductCreationInput } from '../../product/types/explicit-product-creation';
import type { ProductResolutionProposal } from '../../product/types/product-resolution';
import type { ProductSearchProduct } from '../../product/types/product-search';
import type { GroceryItemResponseDto } from '../dto/grocery-item-response.dto';

export enum UnknownProductPolicy {
  create_if_missing = 'create_if_missing',
  propose_if_missing = 'propose_if_missing',
}

export enum ProductResolutionAction {
  use_existing_product = 'use_existing_product',
  add_alias = 'add_alias',
  create_product = 'create_product',
  cancel = 'cancel',
}

export enum PendingGroceryItemPolicy {
  return_existing = 'return_existing',
  create_separate = 'create_separate',
}

export type GroceryAdditionProductInput = ExplicitProductCreationInput;

export interface GroceryAdditionItemInput {
  requestedQuantity?: number;
  unit?: string;
  note?: string;
  ifPendingExists: PendingGroceryItemPolicy;
}

interface GroceryAdditionRequestBase {
  groceryItem: GroceryAdditionItemInput;
  source: GroceryItemSource;
}

export interface CreateIfMissingGroceryAddition extends GroceryAdditionRequestBase {
  unknownProductPolicy: UnknownProductPolicy.create_if_missing;
  product: GroceryAdditionProductInput;
}

export interface ProposeIfMissingGroceryAddition extends GroceryAdditionRequestBase {
  unknownProductPolicy: UnknownProductPolicy.propose_if_missing;
  productName: string;
}

export type PolicyAwareGroceryAddition =
  CreateIfMissingGroceryAddition | ProposeIfMissingGroceryAddition;

export interface GroceryRequestedAddition {
  productName: string;
  requestedQuantity: number | null;
  unit: string | null;
  note: string | null;
  ifPendingExists: PendingGroceryItemPolicy;
}

export interface CreatedGroceryAdditionResult {
  outcome: 'created';
  createdItem: GroceryItemResponseDto;
  existingItems: [];
  requestedAddition: GroceryRequestedAddition;
}

export interface GroceryConfirmationRequiredResult {
  outcome: 'confirmation_required';
  createdItem: null;
  existingItems: GroceryItemResponseDto[];
  requestedAddition: GroceryRequestedAddition;
}

export interface ProductResolutionRequiredResult {
  outcome: 'product_resolution_required';
  requestedAddition: GroceryRequestedAddition;
  candidates: ProductSearchProduct[];
  proposal: ProductResolutionProposal | null;
  allowedActions: ProductResolutionAction[];
}

export type PolicyAwareGroceryAdditionResult =
  | CreatedGroceryAdditionResult
  | GroceryConfirmationRequiredResult
  | ProductResolutionRequiredResult;

export function productResolutionActions(
  candidateCount: number,
): ProductResolutionAction[] {
  return candidateCount > 0
    ? [
        ProductResolutionAction.use_existing_product,
        ProductResolutionAction.add_alias,
        ProductResolutionAction.create_product,
        ProductResolutionAction.cancel,
      ]
    : [ProductResolutionAction.create_product, ProductResolutionAction.cancel];
}
