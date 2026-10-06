import { StockEvidenceService } from './stock-evidence.service';

describe('StockEvidenceService', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const findUnique = jest.fn().mockResolvedValue(null);
  const household = {
    getOrCreate: jest.fn().mockResolvedValue({
      adultsCount: 2,
      childrenCount: 3,
      childAgeGroups: [],
      predictionPreferences: null,
    }),
  };
  const service = new StockEvidenceService(
    {
      inventoryEvent: { findMany },
      productStatistics: { findUnique },
    } as never,
    household as never,
  );
  const product = {
    id: 'p',
    productType: null,
    isPerishable: null,
    predictionStrategy: null,
  };
  it('filters before the limit and orders tied timestamps deterministically', async () => {
    const cutoff = new Date('2026-10-06T10:00:00Z');
    const result = await service.build(product, cutoff);
    expect(findMany).toHaveBeenCalledWith(
      containing({
        where: containing({ timestamp: { lte: cutoff } }),
        take: 20,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.candidate.signals.eventCount).toBe(0);
  });
  it('rejects an invalid cutoff before accessing the database', async () => {
    findMany.mockClear();
    await expect(service.build(product, new Date('invalid'))).rejects.toThrow(
      'Invalid',
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});

function containing(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value) as unknown;
}
