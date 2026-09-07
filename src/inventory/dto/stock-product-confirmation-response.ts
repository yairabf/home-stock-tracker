import type { InventoryEventResponseDto } from './inventory-event-response.dto';
import type { StockProjectionResponseDto } from './stock-mutation-response.dto';

export interface StockProductConfirmationResponse {
  operationId: string;
  productId: string;
  productOutcome: 'created' | 'reused';
  event: Omit<InventoryEventResponseDto, 'timestamp'> & { timestamp: string };
  stock: Omit<StockProjectionResponseDto, 'recordedAt' | 'evaluatedAt'> & {
    recordedAt: string;
    evaluatedAt: string;
  };
}
