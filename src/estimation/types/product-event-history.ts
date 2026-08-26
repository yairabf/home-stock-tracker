import { InventoryEventType } from '../../generated/prisma/enums';

export interface ProductEvent {
  id: string;
  eventType: InventoryEventType;
  timestamp: Date;
  quantity?: number;
  unit?: string;
}

export interface ProductEventHistory {
  productId: string;
  events: ProductEvent[];
  firstEventAt: Date | null;
  lastPurchaseAt: Date | null;
  lastRestockAt: Date | null;
  lastLowStockAt: Date | null;
  lastStockOutAt: Date | null;
  lastStockConfirmationAt: Date | null;
  eventCount: number;
}
