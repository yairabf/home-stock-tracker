import { StockAdviceSnapshot } from './stock-advice-snapshot.service';
import { stockCandidate } from '../estimation/stock-prediction.fixture';
import type { DailyAdviceBaseline } from './stock-advice-policy';

const baseline: DailyAdviceBaseline = {
  productId: 'p',
  projectionId: 'proj',
  revision: 2,
  predictionId: 'pred',
  evaluatedAt: new Date('2026-10-06T10:00:00Z'),
  estimatedQuantity: null,
  estimatedState: 'uncertain',
  confidence: 0.6,
  reason: 'daily_stock_uncertain',
};
describe('StockAdviceSnapshot', () => {
  const product = { findUnique: jest.fn() };
  const stockProjection = { findUnique: jest.fn() };
  const productShelfLifePolicy = { findUnique: jest.fn() };
  const build = jest.fn();
  const service = new StockAdviceSnapshot(
    { product, stockProjection, productShelfLifePolicy } as never,
    { build } as never,
    {
      getOrCreate: jest
        .fn()
        .mockResolvedValue({ adultsCount: 2, childrenCount: 3 }),
    } as never,
  );
  beforeEach(() => {
    product.findUnique.mockResolvedValue({ id: 'p', predictionEnabled: true });
    stockProjection.findUnique.mockResolvedValue({
      revision: 2,
      predictionId: 'pred',
      recordedEventId: 'event',
      recordedQuantity: null,
      unit: 'unit',
      recordedAt: new Date('2026-09-20T00:00:00Z'),
    });
    productShelfLifePolicy.findUnique.mockResolvedValue(null);
    build.mockResolvedValue({
      candidate: stockCandidate(),
      history: { events: [] },
      statistics: null,
    });
  });
  it('rejects a changed revision or deterministic prediction', async () => {
    stockProjection.findUnique.mockResolvedValueOnce({
      revision: 3,
      predictionId: 'pred',
    });
    await expect(service.read(baseline, 'jev-1.13.0')).resolves.toBeNull();
    stockProjection.findUnique.mockResolvedValueOnce({
      revision: 2,
      predictionId: 'other',
    });
    await expect(service.read(baseline, 'jev-1.13.0')).resolves.toBeNull();
  });
  it('includes changed metadata in the fingerprint and minimizes household evidence', async () => {
    const a = await service.read(baseline, 'jev-1.13.0');
    product.findUnique.mockResolvedValue({
      id: 'p',
      predictionEnabled: true,
      category: 'new',
    });
    const b = await service.read(baseline, 'jev-1.13.0');
    expect(a?.fingerprint).not.toBe(b?.fingerprint);
    expect(build).toHaveBeenLastCalledWith(
      expect.anything(),
      baseline.evaluatedAt,
      expect.anything(),
      {
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        predictionPreferences: null,
      },
    );
  });
  it('bypasses disabled products', async () => {
    product.findUnique.mockResolvedValue({ id: 'p', predictionEnabled: false });
    await expect(service.read(baseline, 'jev-1.13.0')).resolves.toBeNull();
  });
});
