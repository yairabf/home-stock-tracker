import {
  acceptedMetadata,
  initialUnderstanding,
  metadataSchema,
  understandingInputSchema,
} from './product-understanding';

const empty = {
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: null,
};
describe('product understanding contracts', () => {
  it('preserves explicit false and all supplied metadata', () => {
    const snapshot = { ...empty, category: 'legacy', isPerishable: false };
    const result = initialUnderstanding(snapshot);
    expect(result.fields.isPerishable).toEqual({
      status: 'resolved',
      source: 'supplied',
      value: false,
    });
    result.fields.category = {
      status: 'resolved',
      source: 'jev',
      value: 'new',
    };
    result.fields.isPerishable = {
      status: 'resolved',
      source: 'jev',
      value: true,
    };
    result.fields.typicalUnit = {
      status: 'resolved',
      source: 'jev',
      value: 'kg',
    };
    expect(acceptedMetadata(snapshot, result)).toEqual({ typicalUnit: 'kg' });
  });
  it('preserves exact selected legacy labels rather than silently trimming them', () => {
    const result = initialUnderstanding(empty);
    result.fields.category = {
      status: 'resolved',
      source: 'jev',
      value: ' Dairy ',
    };
    expect(acceptedMetadata(empty, result)).toEqual({ category: ' Dairy ' });
  });
  it('accepts false while leaving unknown fields absent', () => {
    const result = initialUnderstanding(empty);
    result.fields.isPerishable = {
      status: 'resolved',
      source: 'jev',
      value: false,
    };
    result.fields.category = { status: 'uncertain', reason: 'unknown' };
    expect(acceptedMetadata(empty, result)).toEqual({ isPerishable: false });
  });
  it.each(['', '  ', null, 42])('rejects malformed name %p', (rawName) => {
    expect(
      understandingInputSchema.safeParse({
        rawName,
        metadata: empty,
        categories: [],
        units: [],
      }).success,
    ).toBe(false);
  });
  it('rejects names in metadata, invalid enum, and absent boolean', () => {
    expect(metadataSchema.safeParse({ ...empty, aliases: [] }).success).toBe(
      false,
    );
    expect(
      metadataSchema.safeParse({ ...empty, productType: 'made_up' }).success,
    ).toBe(false);
    expect(
      metadataSchema.safeParse({ ...empty, isPerishable: undefined }).success,
    ).toBe(false);
  });
  it('defensively rejects malformed resolved values at the write boundary', () => {
    const result = initialUnderstanding(empty);
    result.fields.category = { status: 'resolved', source: 'jev', value: '' };
    expect(acceptedMetadata(empty, result)).toEqual({});
  });
});
