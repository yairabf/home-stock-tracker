import type { StockCase, StockDataset } from './dataset';
import { REPLAY_VERSION } from './dataset';
export function stockCase(): StockCase {
  return {
    id: 'safety-case',
    productGroupId: 'safety-product',
    episodeId: 'safety-episode',
    split: 'held_out',
    source: 'authored',
    tags: ['zero_history'],
    asOf: '2026-01-10T00:00:00Z',
    product: {
      knownAt: '2026-01-01T00:00:00Z',
      predictionEnabled: true,
      productType: 'fast_consumable',
      isPerishable: true,
      predictionStrategy: null,
    },
    household: {
      knownAt: '2026-01-01T00:00:00Z',
      adultsCount: 2,
      childrenCount: 3,
    },
    events: [],
    confirmations: [],
    review: {
      author: 'fixture-author',
      status: 'pending',
      reviewer: null,
      reviewedAt: null,
      evidenceReference: null,
      episodeComplete: false,
    },
  };
}
export function stockDataset(): StockDataset {
  return {
    schemaVersion: 1,
    version: 'safety-v1',
    replayVersion: REPLAY_VERSION,
    cases: [stockCase()],
  };
}
