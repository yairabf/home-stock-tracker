import { PredictedState } from '../../generated/prisma/enums';
import { StockProjectionResponseDto } from './stock-mutation-response.dto';

describe('StockProjectionResponseDto', () => {
  it('maps only the load-bearing public projection fields', () => {
    const recordedAt = new Date('2026-09-03T05:00:00.000Z');
    const evaluatedAt = new Date('2026-09-03T08:00:00.000Z');

    const entity = {
      productId: 'product-1',
      unit: 'item',
      recordedQuantity: 4,
      recordedAt,
      recordedSource: 'api',
      recordedEventId: 'event-1',
      estimatedQuantity: 3.5,
      estimatedState: PredictedState.likely_available,
      confidence: 0.8,
      reason: 'purchase_forward_estimated',
      predictionId: null,
      evaluatedAt,
      id: 'internal-projection-id',
      createdAt: recordedAt,
    };
    const result = StockProjectionResponseDto.fromEntity(entity);

    expect(result).toEqual({
      productId: 'product-1',
      unit: 'item',
      recordedQuantity: 4,
      recordedAt,
      recordedSource: 'api',
      recordedEventId: 'event-1',
      estimatedQuantity: 3.5,
      estimatedState: PredictedState.likely_available,
      confidence: 0.8,
      reason: 'purchase_forward_estimated',
      predictionId: null,
      evaluatedAt,
    });
  });
});
