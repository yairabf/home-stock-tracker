import { ProductUnderstandingRunner } from './product-understanding-runner.service';
import { initialUnderstanding } from './product-understanding';
import { ProductUnderstandingCaptureService } from './product-understanding-capture.service';
import { Logger } from '@nestjs/common';
const metadata = {
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: null,
};
describe('ProductUnderstandingRunner', () => {
  const findMany = jest.fn();
  const understand = jest.fn();
  const record = jest.fn();
  const runner = new ProductUnderstandingRunner(
    { product: { findMany } } as never,
    { understand },
    { record } as never,
  );
  beforeEach(() => {
    findMany.mockReset();
    understand.mockReset();
    record.mockReset();
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
    expect(record).toHaveBeenCalledWith(understand.mock.calls[0][0]);
    expect(record.mock.invocationCallOrder[0]).toBeLessThan(
      understand.mock.invocationCallOrder[0],
    );
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
    expect(record).not.toHaveBeenCalled();
  });
  it('waits for capture persistence before dispatching inference', async () => {
    findMany.mockResolvedValue([]);
    let finish!: () => void;
    record.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = runner.understand('Milk', metadata);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(record).toHaveBeenCalledTimes(1);
    expect(understand).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(understand).toHaveBeenCalledTimes(1);
  });
  it('still classifies when enabled capture persistence fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const create = jest.fn().mockRejectedValue(new Error('private detail'));
    const capturedRunner = new ProductUnderstandingRunner(
      { product: { findMany } } as never,
      { understand },
      new ProductUnderstandingCaptureService(
        { llmInferenceLog: { create } } as never,
        { productUnderstandingCaptureEnabled: true } as never,
      ),
    );
    findMany.mockResolvedValue([]);
    const output = initialUnderstanding(metadata);
    understand.mockResolvedValue(output);
    expect(await capturedRunner.understand('Milk', metadata)).toBe(output);
    expect(create).toHaveBeenCalledTimes(1);
    expect(understand).toHaveBeenCalledTimes(1);
    warn.mockRestore();
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
