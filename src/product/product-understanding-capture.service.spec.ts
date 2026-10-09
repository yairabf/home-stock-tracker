import { Logger } from '@nestjs/common';
import { ProductUnderstandingCaptureService } from './product-understanding-capture.service';
import type { ModelConfig } from '../config/application-config';
import type { ProductUnderstandingInput } from './product-understanding';

describe('ProductUnderstandingCaptureService', () => {
  const create = jest.fn();
  const input: ProductUnderstandingInput = {
    rawName: ' חלב Milk ',
    metadata: {
      category: null,
      productType: null,
      typicalUnit: 'carton',
      isPerishable: false,
    },
    categories: [' Dairy ', 'מוצרי חלב'],
    units: ['carton', 'liter'],
  };
  function collector(enabled?: boolean) {
    return new ProductUnderstandingCaptureService(
      { llmInferenceLog: { create } } as never,
      { productUnderstandingCaptureEnabled: enabled } as ModelConfig,
    );
  }
  beforeEach(() => create.mockReset());

  it.each([undefined, false])(
    'does not retain inputs when disabled (%s)',
    async (enabled) => {
      await collector(enabled).record(input);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('preserves exact input and freezes it before persistence awaits', async () => {
    const request = JSON.parse(
      JSON.stringify(input),
    ) as ProductUnderstandingInput;
    let finish!: () => void;
    create.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = collector(true).record(request);
    const saved = create.mock.calls[0][0].data;
    request.rawName = 'changed';
    request.metadata.isPerishable = true;
    request.categories.push('changed');
    expect(saved.structuredResponse.input).toEqual(input);
    expect(saved.structuredResponse).toMatchObject({
      version: 'product-understanding-input-capture-v1',
      captureId: saved.id,
      capturedAt: saved.timestamp.toISOString(),
      capturePhase: 'before_inference',
    });
    expect(saved.modelProvider).toBe('input_capture');
    finish();
    await pending;
  });

  it('uses distinct source IDs for repeated requests', async () => {
    await collector(true).record(input);
    await collector(true).record(input);
    expect(create.mock.calls[0][0].data.id).not.toBe(
      create.mock.calls[1][0].data.id,
    );
  });

  it('does not throw or expose private input on database failure', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    create.mockRejectedValue(new Error('secret database URL'));
    await expect(collector(true).record(input)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Product understanding input capture was not saved',
    );
    warn.mockRestore();
  });
});
