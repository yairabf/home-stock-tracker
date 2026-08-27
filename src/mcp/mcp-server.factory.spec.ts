import { NotFoundException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  GroceryItemSource,
  GroceryItemStatus,
} from '../generated/prisma/enums';
import { GroceryService } from '../grocery/grocery.service';
import { McpServerFactory } from './mcp-server.factory';
import { ProductService } from '../product/product.service';
import type { PredictionEngine } from '../estimation/prediction-engine';
import { PredictedState } from '../generated/prisma/enums';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryEventType } from '../generated/prisma/enums';
import { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';

const item = {
  id: '00000000-0000-4000-8000-000000000001',
  productId: '00000000-0000-4000-8000-000000000002',
  productName: 'milk',
  requestedQuantity: 2,
  unit: 'liter',
  dateAdded: new Date('2026-08-27T10:00:00.000Z'),
  status: GroceryItemStatus.pending,
  note: null,
  source: GroceryItemSource.hermes_whatsapp,
  relatedInventoryEventId: null,
};

describe('McpServerFactory grocery tools', () => {
  let groceryService: jest.Mocked<
    Pick<GroceryService, 'addItem' | 'removeItem' | 'listItems'>
  >;
  let client: Client;
  let closeServer: () => Promise<void>;
  let productService: jest.Mocked<
    Pick<ProductService, 'findOne' | 'findByExactOrAliasName'>
  >;
  let predictionEngine: jest.Mocked<PredictionEngine>;
  let inventoryService: jest.Mocked<
    Pick<InventoryService, 'recordPurchase' | 'recordEvent'>
  >;
  let recommendationService: jest.Mocked<
    Pick<LowStockRecommendationService, 'getRecommendations'>
  >;

  beforeEach(async () => {
    groceryService = {
      addItem: jest.fn(),
      removeItem: jest.fn(),
      listItems: jest.fn(),
    };
    productService = {
      findOne: jest.fn(),
      findByExactOrAliasName: jest.fn(),
    };
    predictionEngine = { predictProduct: jest.fn() };
    inventoryService = {
      recordPurchase: jest.fn(),
      recordEvent: jest.fn(),
    };
    recommendationService = { getRecommendations: jest.fn() };
    const factory = new McpServerFactory(
      groceryService as GroceryService,
      productService as ProductService,
      predictionEngine,
      inventoryService as InventoryService,
      recommendationService as LowStockRecommendationService,
    );
    const server = factory.create();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeServer = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => closeServer());

  it('discovers the three grocery tools with strict schemas', async () => {
    const result = await client.listTools();

    expect(result.tools.map(({ name }) => name)).toEqual([
      'grocery_add',
      'grocery_remove',
      'grocery_list',
      'get_product',
      'get_inventory',
      'record_purchase',
      'record_stock_signal',
      'get_low_stock_predictions',
    ]);
    expect(
      result.tools.find(({ name }) => name === 'grocery_remove')?.inputSchema,
    ).toMatchObject({
      additionalProperties: false,
      required: ['id'],
    });
  });

  it('adds an item with an adapter-owned source and structured output', async () => {
    groceryService.addItem.mockResolvedValue(item);

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: {
        productName: ' milk ',
        requestedQuantity: 2,
        unit: 'liter',
      },
    });

    expect(groceryService.addItem).toHaveBeenCalledWith({
      productName: 'milk',
      requestedQuantity: 2,
      unit: 'liter',
      source: GroceryItemSource.hermes_whatsapp,
    });
    expect(result.structuredContent).toEqual({
      ...item,
      dateAdded: item.dateAdded.toISOString(),
    });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent) },
    ]);
  });

  it('lists pending items by default and preserves an empty list', async () => {
    groceryService.listItems.mockResolvedValue([]);

    const result = await client.callTool({
      name: 'grocery_list',
      arguments: {},
    });

    expect(groceryService.listItems).toHaveBeenCalledWith(undefined);
    expect(result.structuredContent).toEqual({ items: [] });
  });

  it('removes an item and returns expected domain errors as tool errors', async () => {
    groceryService.removeItem.mockRejectedValue(
      new NotFoundException(`Grocery list item ${item.id} not found`),
    );

    const result = await client.callTool({
      name: 'grocery_remove',
      arguments: { id: item.id },
    });

    expect(groceryService.removeItem).toHaveBeenCalledWith(item.id);
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `Grocery list item ${item.id} not found` },
    ]);
  });

  it('rejects malformed input without invoking the service', async () => {
    const result = await client.callTool({
      name: 'grocery_add',
      arguments: { productName: '', requestedQuantity: 0 },
    });

    expect(result.isError).toBe(true);
    expect(groceryService.addItem).not.toHaveBeenCalled();
  });

  it('gets a product by UUID with the existing response contract', async () => {
    productService.findOne.mockResolvedValue({
      id: item.productId,
      canonicalName: 'milk',
      aliases: ['whole milk'],
      category: 'dairy',
      typicalUnit: 'liter',
      productType: null,
      isPerishable: true,
      predictionStrategy: null,
      predictionEnabled: true,
      config: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    const result = await client.callTool({
      name: 'get_product',
      arguments: { id: item.productId },
    });

    expect(productService.findOne).toHaveBeenCalledWith(item.productId);
    expect(result.structuredContent).toMatchObject({
      id: item.productId,
      canonicalName: 'milk',
      predictionEnabled: true,
    });
  });

  it('gets a product by exact name or alias with the existing response contract', async () => {
    productService.findByExactOrAliasName.mockResolvedValue({
      id: item.productId,
      canonicalName: 'milk',
      aliases: ['whole milk'],
      category: 'dairy',
      typicalUnit: 'liter',
      productType: null,
      isPerishable: true,
      predictionStrategy: null,
      predictionEnabled: true,
      config: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    const result = await client.callTool({
      name: 'get_product',
      arguments: { productName: ' whole milk ' },
    });

    expect(productService.findByExactOrAliasName).toHaveBeenCalledWith(
      'whole milk',
    );
    expect(result.structuredContent).toMatchObject({
      id: item.productId,
      canonicalName: 'milk',
    });
    expect(productService.findOne).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { id: item.productId, productName: 'milk' },
    { productName: '' },
  ])('rejects an invalid product selector before service invocation', async (args) => {
    const result = await client.callTool({
      name: 'get_product',
      arguments: args,
    });

    expect(result.isError).toBe(true);
    expect(productService.findOne).not.toHaveBeenCalled();
    expect(productService.findByExactOrAliasName).not.toHaveBeenCalled();
  });

  it('returns an unknown product name as an MCP tool error', async () => {
    productService.findByExactOrAliasName.mockRejectedValue(
      new NotFoundException('No product named "oat milk"'),
    );

    const result = await client.callTool({
      name: 'get_product',
      arguments: { productName: 'oat milk' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'No product named "oat milk"' },
    ]);
  });

  it('returns a cold-start inventory estimate without inventing quantity', async () => {
    predictionEngine.predictProduct.mockResolvedValue({
      predictionId: null,
      productId: item.productId,
      predictedState: PredictedState.uncertain,
      confidenceScore: 0,
      reason: 'Not enough household history',
      recommendedAction: null,
      llmContributed: false,
      deterministicSignals: {
        lastPurchaseAt: null,
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        daysSinceLastPurchase: null,
        daysSinceLastLowSignal: null,
        productType: null,
        eventCount: 0,
        coldStart: true,
        hasLearnedStatistics: false,
        avgPurchaseIntervalDays: null,
        avgNeedIntervalDays: null,
        estimatedConsumptionIntervalDays: null,
        observationCount: 0,
        isPerishable: false,
        predictionStrategy: null,
        householdContext: null,
        authoritativeDirectSignal: false,
      },
    });

    const result = await client.callTool({
      name: 'get_inventory',
      arguments: { id: item.productId },
    });

    expect(predictionEngine.predictProduct).toHaveBeenCalledWith(
      item.productId,
    );
    expect(result.structuredContent).toMatchObject({
      productId: item.productId,
      predictedState: PredictedState.uncertain,
      deterministicSignals: { coldStart: true, eventCount: 0 },
    });
    expect(result.structuredContent).not.toHaveProperty('quantity');
  });

  it('rejects malformed read IDs before invoking services', async () => {
    const productResult = await client.callTool({
      name: 'get_product',
      arguments: { id: 'not-a-uuid' },
    });
    const inventoryResult = await client.callTool({
      name: 'get_inventory',
      arguments: { id: 'not-a-uuid' },
    });

    expect(productResult.isError).toBe(true);
    expect(inventoryResult.isError).toBe(true);
    expect(productService.findOne).not.toHaveBeenCalled();
    expect(predictionEngine.predictProduct).not.toHaveBeenCalled();
  });

  it('returns unknown products as MCP tool errors', async () => {
    productService.findOne.mockRejectedValue(
      new NotFoundException(`No product with id "${item.productId}"`),
    );

    const result = await client.callTool({
      name: 'get_product',
      arguments: { id: item.productId },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `No product with id "${item.productId}"` },
    ]);
  });

  it('records a purchase with MCP provenance and structured output', async () => {
    const event = inventoryEvent(InventoryEventType.PURCHASED);
    inventoryService.recordPurchase.mockResolvedValue(event);

    const result = await client.callTool({
      name: 'record_purchase',
      arguments: {
        productId: item.productId,
        eventType: InventoryEventType.PURCHASED,
        quantity: 2,
        unit: 'liter',
        metadata: { store: 'market' },
      },
    });

    expect(inventoryService.recordPurchase).toHaveBeenCalledWith({
      productId: item.productId,
      eventType: InventoryEventType.PURCHASED,
      quantity: 2,
      unit: 'liter',
      metadata: { store: 'market' },
      source: 'hermes_mcp',
    });
    expect(result.structuredContent).toEqual({
      ...event,
      timestamp: event.timestamp.toISOString(),
    });
  });

  it.each([
    InventoryEventType.STOCK_LOW,
    InventoryEventType.STOCK_OUT,
    InventoryEventType.STOCK_CONFIRMED,
    InventoryEventType.STOCK_CORRECTED,
  ])('records the allowed %s stock signal', async (eventType) => {
    inventoryService.recordEvent.mockResolvedValue(inventoryEvent(eventType));

    const result = await client.callTool({
      name: 'record_stock_signal',
      arguments: { productId: item.productId, eventType },
    });

    expect(result.isError).not.toBe(true);
    expect(inventoryService.recordEvent).toHaveBeenLastCalledWith({
      productId: item.productId,
      eventType,
      source: 'hermes_mcp',
    });
  });

  it('rejects unrelated event types before invoking inventory services', async () => {
    const stockResult = await client.callTool({
      name: 'record_stock_signal',
      arguments: {
        productId: item.productId,
        eventType: InventoryEventType.PREDICTION_ACCEPTED,
      },
    });
    const purchaseResult = await client.callTool({
      name: 'record_purchase',
      arguments: {
        productId: item.productId,
        eventType: InventoryEventType.STOCK_LOW,
      },
    });

    expect(stockResult.isError).toBe(true);
    expect(purchaseResult.isError).toBe(true);
    expect(inventoryService.recordEvent).not.toHaveBeenCalled();
    expect(inventoryService.recordPurchase).not.toHaveBeenCalled();
  });

  it('returns missing products from writes as MCP tool errors', async () => {
    inventoryService.recordPurchase.mockRejectedValue(
      new NotFoundException(`No product with id "${item.productId}"`),
    );

    const result = await client.callTool({
      name: 'record_purchase',
      arguments: {
        productId: item.productId,
        eventType: InventoryEventType.RESTOCKED,
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: `No product with id "${item.productId}"` },
    ]);
  });

  it('returns empty and populated low-stock recommendations', async () => {
    recommendationService.getRecommendations.mockResolvedValueOnce([]);
    const empty = await client.callTool({
      name: 'get_low_stock_predictions',
      arguments: {},
    });

    recommendationService.getRecommendations.mockResolvedValueOnce([
      {
        productId: item.productId,
        productName: 'milk',
        predictionId: null,
        predictedState: PredictedState.probably_low,
        confidenceScore: 0.9,
        reason: 'Expected interval has elapsed',
        recommendedAction: 'Add milk to the grocery list',
      },
    ]);
    const populated = await client.callTool({
      name: 'get_low_stock_predictions',
      arguments: {},
    });

    expect(empty.structuredContent).toEqual({ recommendations: [] });
    expect(populated.structuredContent).toMatchObject({
      recommendations: [
        {
          productId: item.productId,
          predictedState: PredictedState.probably_low,
          confidenceScore: 0.9,
        },
      ],
    });
  });

  it('sanitizes unexpected service failures', async () => {
    recommendationService.getRecommendations.mockRejectedValue(
      new Error('database password leaked here'),
    );

    const result = await client.callTool({
      name: 'get_low_stock_predictions',
      arguments: {},
    });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'The inventory operation could not be completed',
        },
      ],
      isError: true,
    });
  });
});

function inventoryEvent(eventType: InventoryEventType) {
  return {
    id: '00000000-0000-4000-8000-000000000003',
    productId: item.productId,
    eventType,
    quantity: 2,
    unit: 'liter',
    timestamp: new Date('2026-08-27T12:00:00.000Z'),
    source: 'hermes_mcp',
    confidence: null,
    metadata: null,
  };
}
