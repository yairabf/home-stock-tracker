import { z } from 'zod';
import {
  GroceryItemStatus,
  GroceryItemSource,
  InventoryEventType,
  PredictedState,
  ProductType,
} from '../generated/prisma/enums';

export const PUBLISHED_INVENTORY_EVENT_TYPES = [
  InventoryEventType.GROCERY_ADDED,
  InventoryEventType.GROCERY_REMOVED,
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
  InventoryEventType.STOCK_LOW,
  InventoryEventType.STOCK_OUT,
  InventoryEventType.STOCK_CONFIRMED,
  InventoryEventType.STOCK_CORRECTED,
  InventoryEventType.PREDICTION_ACCEPTED,
  InventoryEventType.PREDICTION_REJECTED,
  InventoryEventType.INFERRED_LOW_STOCK,
  InventoryEventType.STOCK_SET,
  InventoryEventType.STOCK_CONSUMED,
] as const;

export const groceryItemOutputSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  category: z.string().nullable(),
  requestedQuantity: z.number().positive().finite(),
  unit: z.string().nullable(),
  dateAdded: z.string(),
  status: z.enum(GroceryItemStatus),
  note: z.string().nullable(),
  source: z.enum(GroceryItemSource),
  relatedInventoryEventId: z.string().nullable(),
});

export const productOutputSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()),
  category: z.string().nullable(),
  typicalUnit: z.string().nullable(),
  productType: z.enum(ProductType).nullable(),
  isPerishable: z.boolean().nullable(),
  predictionStrategy: z.string().nullable(),
  predictionEnabled: z.boolean(),
  config: z.json().nullable(),
});

export const productSearchProductOutputSchema = productOutputSchema.omit({
  predictionStrategy: true,
  config: true,
});

export const inventoryEventOutputSchema = z.object({
  id: z.string(),
  productId: z.string(),
  eventType: z.enum(PUBLISHED_INVENTORY_EVENT_TYPES),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  timestamp: z.string(),
  source: z.string(),
  confidence: z.number().nullable(),
  metadata: z.json().nullable(),
});

export const stockProjectionOutputSchema = z.object({
  productId: z.string(),
  unit: z.string(),
  recordedQuantity: z.number().nullable(),
  recordedAt: z.string(),
  recordedSource: z.string(),
  recordedEventId: z.string(),
  estimatedQuantity: z.number().nullable(),
  estimatedState: z.enum(PredictedState),
  confidence: z.number(),
  reason: z.string(),
  predictionId: z.string().nullable(),
  evaluatedAt: z.string(),
});

export const stockMutationOutputSchema = z.object({
  event: inventoryEventOutputSchema,
  stock: stockProjectionOutputSchema,
});
