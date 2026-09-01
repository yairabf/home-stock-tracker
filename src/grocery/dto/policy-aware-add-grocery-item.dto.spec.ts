import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductType } from '../../generated/prisma/enums';
import {
  PendingGroceryItemPolicy,
  ProductResolutionAction,
  UnknownProductPolicy,
  productResolutionActions,
} from '../types/policy-aware-grocery-addition';
import { PolicyAwareAddGroceryItemDto } from './policy-aware-add-grocery-item.dto';

const product = {
  canonicalName: '3% Milk',
  aliases: ['Three Percent Milk'],
  category: 'dairy',
  typicalUnit: 'carton',
  productType: ProductType.fast_consumable,
  isPerishable: true,
};

describe('PolicyAwareAddGroceryItemDto', () => {
  it('defaults REST-shaped input to deterministic creation', async () => {
    const dto = plainToInstance(PolicyAwareAddGroceryItemDto, {
      product,
      groceryItem: {},
    });

    await expect(validateDto(dto)).resolves.toHaveLength(0);
    expect(dto.unknownProductPolicy).toBe(
      UnknownProductPolicy.create_if_missing,
    );
    expect(dto.groceryItem.ifPendingExists).toBe(
      PendingGroceryItemPolicy.return_existing,
    );
  });

  it('accepts the explicit proposal branch', async () => {
    const dto = plainToInstance(PolicyAwareAddGroceryItemDto, {
      unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
      productName: '  milk  ',
      groceryItem: { requestedQuantity: 0.5 },
    });

    await expect(validateDto(dto)).resolves.toHaveLength(0);
    expect(dto.productName).toBe('milk');
  });

  it.each([
    ['mixed product inputs', { product, productName: 'milk' }],
    ['missing deterministic product', {}],
    [
      'missing proposal phrase',
      { unknownProductPolicy: UnknownProductPolicy.propose_if_missing },
    ],
  ])('rejects %s', async (_label, input) => {
    const dto = plainToInstance(PolicyAwareAddGroceryItemDto, {
      ...input,
      groceryItem: {},
    });

    expect(await validateDto(dto)).not.toHaveLength(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid quantity %s',
    async (requestedQuantity) => {
      const dto = plainToInstance(PolicyAwareAddGroceryItemDto, {
        product,
        groceryItem: { requestedQuantity },
      });

      expect(await validateDto(dto)).not.toHaveLength(0);
    },
  );

  it('rejects unknown nested fields under whitelist validation', async () => {
    const dto = plainToInstance(PolicyAwareAddGroceryItemDto, {
      product: { ...product, predictionEnabled: false },
      groceryItem: {},
    });

    expect(await validateDto(dto)).not.toHaveLength(0);
  });
});

describe('productResolutionActions', () => {
  it('allows create or cancel without candidates', () => {
    expect(productResolutionActions(0)).toEqual([
      ProductResolutionAction.create_product,
      ProductResolutionAction.cancel,
    ]);
  });

  it('returns every action in stable order when candidates exist', () => {
    expect(productResolutionActions(1)).toEqual([
      ProductResolutionAction.use_existing_product,
      ProductResolutionAction.add_alias,
      ProductResolutionAction.create_product,
      ProductResolutionAction.cancel,
    ]);
  });
});

function validateDto(dto: PolicyAwareAddGroceryItemDto) {
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}
