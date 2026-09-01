import { ProductType } from '../../generated/prisma/enums';
import {
  confirmNewProductInputSchema,
  confirmProductAliasInputSchema,
} from './grocery-confirmation.schema';

const product = {
  canonicalName: '3% Milk',
  aliases: ['Three Percent Milk'],
  category: 'dairy',
  typicalUnit: 'carton',
  productType: ProductType.fast_consumable,
  isPerishable: true,
};

describe('grocery confirmation MCP schemas', () => {
  it('accepts final product and alias confirmation payloads', () => {
    expect(
      confirmNewProductInputSchema.parse({ product, groceryItem: {} }),
    ).toEqual({ product, groceryItem: {} });
    expect(
      confirmProductAliasInputSchema.parse({
        targetProductId: '11111111-1111-4111-8111-111111111111',
        alias: 'Milk',
        groceryItem: { requestedQuantity: 2 },
      }),
    ).toMatchObject({ alias: 'Milk' });
  });

  it.each([
    ['proposal state', { product, groceryItem: {}, proposalId: 'proposal-1' }],
    ['source', { product, groceryItem: {}, source: 'mcp' }],
    [
      'pending override',
      { product, groceryItem: { ifPendingExists: 'create_separate' } },
    ],
  ])('rejects confirmed product %s', (_label, input) => {
    expect(confirmNewProductInputSchema.safeParse(input).success).toBe(false);
  });

  it('requires an exact target ID and approved alias', () => {
    expect(
      confirmProductAliasInputSchema.safeParse({
        targetProductId: 'milk',
        alias: '',
        groceryItem: {},
      }).success,
    ).toBe(false);
  });
});
