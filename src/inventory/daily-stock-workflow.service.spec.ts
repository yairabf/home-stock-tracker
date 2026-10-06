import type { OperationalLogger } from '../observability/operational-logger.service';
import type { DailyStockMaterializationService } from './daily-stock-materialization.service';
import { DailyStockWorkflowService } from './daily-stock-workflow.service';
import type { ShelfLifeInferenceService } from './shelf-life-inference.service';

describe('DailyStockWorkflowService', () => {
  const calls: string[] = [];
  const findMany = jest.fn();
  const inferMissingPolicies = jest.fn();
  const evaluateProduct = jest.fn();
  const stockWorkflow = jest.fn();
  const advice = { enabled: false, execute: jest.fn() };
  const adviceWriter = { publish: jest.fn() };
  const config = { adviceMaxProducts: 20 };
  const service = new DailyStockWorkflowService(
    { stockProjection: { findMany } } as never,
    { inferMissingPolicies } as unknown as ShelfLifeInferenceService,
    { evaluateProduct } as unknown as DailyStockMaterializationService,
    { stockWorkflow } as unknown as OperationalLogger,
    advice as never,
    adviceWriter as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    advice.enabled = false;
    config.adviceMaxProducts = 20;
    advice.execute.mockResolvedValue({ accepted: true });
    inferMissingPolicies.mockImplementation(() => {
      calls.push('inference');
      return Promise.resolve({
        processed: 2,
        succeeded: 1,
        skipped: 1,
        failed: 0,
      });
    });
    findMany.mockImplementation(() => {
      calls.push('list-projections');
      return Promise.resolve([{ productId: 'one' }, { productId: 'two' }]);
    });
    evaluateProduct.mockImplementation((productId: string) => {
      calls.push(`evaluate:${productId}`);
      return Promise.resolve({ predictionId: productId });
    });
  });

  afterEach(() => jest.useRealTimers());

  it('runs inference before every tracked projection and reports stable counts', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T02:00:00.000Z'));
    const summary = await service.run();

    expect(calls).toEqual([
      'inference',
      'list-projections',
      'evaluate:one',
      'evaluate:two',
    ]);
    expect(summary).toEqual({
      startedAt: new Date('2026-09-03T02:00:00.000Z'),
      completedAt: new Date('2026-09-03T02:00:00.000Z'),
      durationMs: 0,
      shelfLife: { processed: 2, succeeded: 1, skipped: 1, failed: 0 },
      evaluation: { processed: 2, succeeded: 2, skipped: 0, failed: 0 },
    });
    expect(stockWorkflow).toHaveBeenNthCalledWith(1, {
      stage: 'start',
      outcome: 'success',
    });
    expect(stockWorkflow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ stage: 'end', outcome: 'success' }),
    );
  });

  it('isolates product failures and continues later evaluations', async () => {
    evaluateProduct
      .mockRejectedValueOnce(new Error('one failed'))
      .mockResolvedValueOnce(null);

    const summary = await service.run(new Date('2026-09-03T02:00:00.000Z'));

    expect(evaluateProduct).toHaveBeenCalledTimes(2);
    expect(stockWorkflow).toHaveBeenCalledWith({
      stage: 'product_failure',
      outcome: 'failure',
      phase: 'evaluation',
      productId: 'one',
    });
    expect(summary.evaluation).toEqual({
      processed: 2,
      succeeded: 0,
      skipped: 1,
      failed: 1,
    });
    expect(stockWorkflow).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'end', outcome: 'failure' }),
    );
  });

  it('continues to stock evaluation when the inference phase cannot start', async () => {
    inferMissingPolicies.mockRejectedValue(new Error('query failed'));

    const summary = await service.run(new Date('2026-09-03T02:00:00.000Z'));

    expect(calls).toEqual(['list-projections', 'evaluate:one', 'evaluate:two']);
    expect(summary.shelfLife).toEqual({
      processed: 0,
      succeeded: 0,
      skipped: 0,
      failed: 1,
    });
    expect(summary.evaluation.succeeded).toBe(2);
  });
  it('bounds advice snapshots without limiting deterministic evaluation', async () => {
    advice.enabled = true;
    config.adviceMaxProducts = 1;
    await service.run();
    expect(findMany).toHaveBeenCalledWith({
      select: { productId: true },
      orderBy: { productId: 'asc' },
    });
    expect(advice.execute).toHaveBeenCalledTimes(1);
    expect(evaluateProduct).toHaveBeenCalledTimes(2);
    expect(adviceWriter.publish).toHaveBeenCalledTimes(1);
  });
  it('isolates advice failures after successful deterministic writes', async () => {
    advice.enabled = true;
    advice.execute
      .mockRejectedValueOnce(new Error('provider'))
      .mockResolvedValueOnce({ accepted: true });
    const summary = await service.run();
    expect(summary.evaluation).toEqual({
      processed: 2,
      succeeded: 2,
      skipped: 0,
      failed: 0,
    });
    expect(advice.execute).toHaveBeenCalledTimes(2);
    expect(adviceWriter.publish).toHaveBeenCalledTimes(1);
    expect(stockWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'stock_advice', outcome: 'failure' }),
    );
  });
  it('keeps default daily evaluation inference-free for stock advice', async () => {
    await service.run();
    expect(advice.execute).not.toHaveBeenCalled();
  });
});
