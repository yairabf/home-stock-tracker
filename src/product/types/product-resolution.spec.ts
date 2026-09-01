import { ProductType } from '../../generated/prisma/enums';
import {
  PRODUCT_RESOLUTION_MAX_ALIASES,
  PRODUCT_RESOLUTION_MAX_CANDIDATES,
  PRODUCT_RESOLUTION_MAX_ID_LENGTH,
  productResolutionContextSchema,
  productResolutionProposalSchema,
} from './product-resolution';

const common = { confidence: 0.7, reason: 'A valid reason' };

describe('product resolution proposal contracts', () => {
  it('normalizes valid create advice while preserving display case', () => {
    expect(
      productResolutionProposalSchema.parse({
        recommendation: 'create_product',
        newProduct: {
          canonicalName: '  ３％\t Milk ',
          aliases: [' Three Percent Milk '],
          category: ' Dairy ',
          typicalUnit: ' Carton ',
          productType: ProductType.fast_consumable,
          isPerishable: true,
        },
        ...common,
      }),
    ).toEqual({
      recommendation: 'create_product',
      newProduct: {
        canonicalName: '3% Milk',
        aliases: ['Three Percent Milk'],
        category: 'Dairy',
        typicalUnit: 'Carton',
        productType: ProductType.fast_consumable,
        isPerishable: true,
      },
      ...common,
    });
  });

  it.each([
    {
      recommendation: 'add_alias',
      targetProductId: 'product-a',
      alias: '  Whole\tMilk ',
      ...common,
    },
    {
      recommendation: 'ask_user_to_choose',
      candidateProductIds: ['product-a', 'product-b'],
      ...common,
    },
  ])('accepts valid advice: $recommendation', (proposal) => {
    expect(productResolutionProposalSchema.safeParse(proposal).success).toBe(
      true,
    );
  });

  it.each([
    { ...validAlias(), newProduct: validCreate().newProduct },
    { ...validAlias(), extra: true },
    { ...validAlias(), confidence: Number.NaN },
    { ...validAlias(), confidence: Number.POSITIVE_INFINITY },
    { ...validAlias(), confidence: -0.01 },
    { ...validAlias(), confidence: 1.01 },
    { ...validAlias(), alias: ' ' },
    {
      ...validAlias(),
      targetProductId: 'x'.repeat(PRODUCT_RESOLUTION_MAX_ID_LENGTH + 1),
    },
    {
      ...validChoice(),
      candidateProductIds: [
        'product-a',
        'x'.repeat(PRODUCT_RESOLUTION_MAX_ID_LENGTH + 1),
      ],
    },
    { ...validAlias(), reason: 'x'.repeat(501) },
    {
      ...validChoice(),
      candidateProductIds: ['product-a'],
    },
    {
      ...validChoice(),
      candidateProductIds: ['product-a', 'product-a'],
    },
    {
      ...validChoice(),
      candidateProductIds: Array.from(
        { length: PRODUCT_RESOLUTION_MAX_CANDIDATES + 1 },
        (_, index) => `product-${index}`,
      ),
    },
    {
      ...validCreate(),
      newProduct: {
        ...validCreate().newProduct,
        aliases: ['Milk', ' milk '],
      },
    },
    {
      ...validCreate(),
      newProduct: {
        ...validCreate().newProduct,
        aliases: ['Whole Milk', ' whole milk '],
      },
    },
    {
      ...validCreate(),
      newProduct: {
        ...validCreate().newProduct,
        aliases: Array.from(
          { length: PRODUCT_RESOLUTION_MAX_ALIASES + 1 },
          (_, index) => `Alias ${index}`,
        ),
      },
    },
  ])('rejects invalid advice: %j', (proposal) => {
    expect(productResolutionProposalSchema.safeParse(proposal).success).toBe(
      false,
    );
  });

  it.each([0, 1])('accepts confidence boundary %s', (confidence) => {
    expect(
      productResolutionProposalSchema.safeParse({
        ...validAlias(),
        confidence,
      }).success,
    ).toBe(true);
  });
});

describe('product resolution context contract', () => {
  const candidate = {
    id: 'product-a',
    canonicalName: 'Milk',
    aliases: ['Whole Milk'],
    category: 'dairy',
    typicalUnit: 'carton',
    productType: ProductType.fast_consumable,
    isPerishable: true,
  };

  it('normalizes requested identity and accepts only allowlisted fields', () => {
    expect(
      productResolutionContextSchema.parse({
        requestedPhrase: '  ＭＩＬＫ ',
        candidates: [candidate],
      }),
    ).toEqual({ requestedPhrase: 'milk', candidates: [candidate] });
    expect(
      productResolutionContextSchema.safeParse({
        requestedPhrase: 'milk',
        candidates: [{ ...candidate, predictionEnabled: true }],
      }).success,
    ).toBe(false);
  });

  it('retains every ordered existing alias within the byte budget', () => {
    const aliases = Array.from({ length: 11 }, (_, index) => `Alias ${index}`);

    expect(
      productResolutionContextSchema.parse({
        requestedPhrase: 'milk',
        candidates: [{ ...candidate, aliases }],
      }).candidates[0].aliases,
    ).toEqual(aliases);
  });

  it('rejects context beyond the candidate cap', () => {
    expect(
      productResolutionContextSchema.safeParse({
        requestedPhrase: 'milk',
        candidates: Array.from(
          { length: PRODUCT_RESOLUTION_MAX_CANDIDATES + 1 },
          (_, index) => ({ ...candidate, id: `product-${index}` }),
        ),
      }).success,
    ).toBe(false);
  });
});

function validAlias() {
  return {
    recommendation: 'add_alias' as const,
    targetProductId: 'product-a',
    alias: 'Whole Milk',
    ...common,
  };
}

function validChoice() {
  return {
    recommendation: 'ask_user_to_choose' as const,
    candidateProductIds: ['product-a', 'product-b'],
    ...common,
  };
}

function validCreate() {
  return {
    recommendation: 'create_product' as const,
    newProduct: {
      canonicalName: 'Milk',
      aliases: ['Whole Milk'],
      category: 'dairy',
      typicalUnit: 'carton',
      productType: ProductType.fast_consumable,
      isPerishable: true,
    },
    ...common,
  };
}
