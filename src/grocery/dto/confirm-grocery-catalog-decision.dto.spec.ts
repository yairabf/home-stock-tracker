import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductType } from '../../generated/prisma/enums';
import {
  ConfirmNewProductGroceryItemDto,
  ConfirmProductAliasGroceryItemDto,
} from './confirm-grocery-catalog-decision.dto';

const product = {
  canonicalName: '3% Milk',
  aliases: ['Three Percent Milk'],
  category: 'dairy',
  typicalUnit: 'carton',
  productType: ProductType.fast_consumable,
  isPerishable: true,
};

describe('confirmed grocery catalog DTOs', () => {
  it('accepts separate approved product and grocery inputs', async () => {
    const dto = plainToInstance(ConfirmNewProductGroceryItemDto, {
      product,
      groceryItem: { requestedQuantity: 2, unit: 'cartons' },
    });

    await expect(validateDto(dto)).resolves.toHaveLength(0);
  });

  it('accepts an exact alias target and trims the approved alias', async () => {
    const dto = plainToInstance(ConfirmProductAliasGroceryItemDto, {
      targetProductId: '11111111-1111-4111-8111-111111111111',
      alias: '  Three Percent Milk  ',
      groceryItem: {},
    });

    await expect(validateDto(dto)).resolves.toHaveLength(0);
    expect(dto.alias).toBe('Three Percent Milk');
  });

  it.each([
    ['proposal state', { proposalId: 'proposal-1' }],
    ['transport source', { source: 'api' }],
    [
      'pending override',
      { groceryItem: { ifPendingExists: 'create_separate' } },
    ],
  ])('rejects %s in confirmed product input', async (_label, extra) => {
    const dto = plainToInstance(ConfirmNewProductGroceryItemDto, {
      product,
      groceryItem: {},
      ...extra,
    });

    expect(await validateDto(dto)).not.toHaveLength(0);
  });

  it.each([
    ['non-UUID target', { targetProductId: 'milk' }],
    ['blank alias', { alias: '   ' }],
    ['non-positive quantity', { groceryItem: { requestedQuantity: 0 } }],
  ])('rejects alias confirmation with %s', async (_label, override) => {
    const dto = plainToInstance(ConfirmProductAliasGroceryItemDto, {
      targetProductId: '11111111-1111-4111-8111-111111111111',
      alias: 'Milk',
      groceryItem: {},
      ...override,
    });

    expect(await validateDto(dto)).not.toHaveLength(0);
  });
});

function validateDto(dto: object) {
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}
