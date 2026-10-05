import { ProductUnderstandingRunner } from './product-understanding-runner.service';
import { initialUnderstanding } from './product-understanding';
const metadata = {
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: null,
};
describe('ProductUnderstandingRunner', () => {
  const findMany = jest.fn();
  const understand = jest.fn();
  const runner = new ProductUnderstandingRunner(
    { product: { findMany } } as never,
    { understand },
  );
  beforeEach(() => {
    findMany.mockReset();
    understand.mockReset();
  });
  it('collects complete distinct labels without truncation or normalization', async () => {
    findMany
      .mockResolvedValueOnce([
        { category: ' Dairy ' },
        { category: '' },
        { category: null },
      ])
      .mockResolvedValueOnce([{ typicalUnit: 'carton' }, { typicalUnit: ' ' }]);
    const output = initialUnderstanding(metadata);
    understand.mockResolvedValue(output);
    expect(await runner.understand('Milk', metadata)).toBe(output);
    expect(understand).toHaveBeenCalledWith({
      rawName: 'Milk',
      metadata,
      categories: [' Dairy '],
      units: ['carton'],
    });
    expect(
      (findMany.mock.calls as unknown as Array<[{ take?: number }]>).map(
        (call) => call[0].take,
      ),
    ).toEqual([undefined, undefined]);
  });
  it('makes no database or provider request for complete metadata', async () => {
    await runner.understand('Milk', {
      category: 'dairy',
      typicalUnit: 'liter',
      productType: 'fast_consumable',
      isPerishable: false,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(understand).not.toHaveBeenCalled();
  });
  it.each(['database', 'provider'])(
    'preserves supplied metadata after %s failure',
    async (failure) => {
      if (failure === 'database')
        findMany.mockRejectedValue(new Error('private detail'));
      else {
        findMany.mockResolvedValue([]);
        understand.mockRejectedValue(new Error('private detail'));
      }
      const result = await runner.understand('Milk', {
        ...metadata,
        isPerishable: false,
      });
      expect(result.fields.isPerishable).toEqual({
        status: 'resolved',
        source: 'supplied',
        value: false,
      });
      expect(result.fields.category).toEqual({ status: 'unavailable' });
    },
  );
});
