import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { OperationalLogger } from '../observability/operational-logger.service';
import { AddGroceryItemOutcome } from '../grocery/dto/add-grocery-item-result.dto';

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
    Pick<GroceryService, 'addItem' | 'updateItem' | 'removeItem' | 'listItems'>
  >;
  let client: Client;
  let closeServer: () => Promise<void>;
  let productService: jest.Mocked<
    Pick<ProductService, 'findOne' | 'findByExactOrAliasName'>
  >;
  let predictionEngine: jest.Mocked<PredictionEngine>;
  let inventoryService: jest.Mocked<
    Pick<
      InventoryService,
      'recordPurchase' | 'recordEvent' | 'completeGroceryPurchase'
    >
  >;
  let recommendationService: jest.Mocked<
    Pick<LowStockRecommendationService, 'getRecommendations'>
  >;
  let operationalLogger: jest.Mocked<Pick<OperationalLogger, 'mcpIntegration'>>;

  beforeEach(async () => {
    groceryService = {
      addItem: jest.fn(),
      updateItem: jest.fn(),
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
      completeGroceryPurchase: jest.fn(),
    };
    recommendationService = { getRecommendations: jest.fn() };
    operationalLogger = { mcpIntegration: jest.fn() };
    const factory = new McpServerFactory(
      groceryService as GroceryService,
      productService as ProductService,
      predictionEngine,
      inventoryService as InventoryService,
      recommendationService as LowStockRecommendationService,
      operationalLogger as OperationalLogger,
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
      'grocery_update',
      'grocery_remove',
      'grocery_list',
      'get_product',
      'get_inventory',
      'record_purchase',
      'record_stock_signal',
      'complete_grocery_purchase',
      'get_low_stock_predictions',
    ]);
    expect(
      result.tools.find(({ name }) => name === 'grocery_update')?.inputSchema,
    ).toMatchObject({
      additionalProperties: false,
      required: [
        'id',
        'quantityMode',
        'quantity',
        'expectedRequestedQuantity',
        'expectedUnit',
      ],
    });
    expect(
      result.tools.find(({ name }) => name === 'grocery_remove')?.inputSchema,
    ).toMatchObject({
      additionalProperties: false,
      required: ['id'],
    });
    expect(
      result.tools.find(({ name }) => name === 'get_product')?.inputSchema,
    ).toMatchObject({
      additionalProperties: false,
      properties: {
        id: { type: 'string', format: 'uuid' },
        productName: { type: 'string', minLength: 1 },
      },
      type: 'object',
    });
    for (const name of [
      'grocery_add',
      'record_purchase',
      'record_stock_signal',
      'complete_grocery_purchase',
    ]) {
      const schema = result.tools.find(
        (tool) => tool.name === name,
      )?.inputSchema;
      expect(schema).toMatchObject({ additionalProperties: false });
      expect(schema?.properties).not.toHaveProperty('source');
    }
  });

  it('updates a pending item with expected values and structured output', async () => {
    groceryService.updateItem.mockResolvedValue({
      ...item,
      requestedQuantity: 3,
    });

    const result = await client.callTool({
      name: 'grocery_update',
      arguments: {
        id: item.id,
        quantityMode: 'increment',
        quantity: 1,
        unit: 'liter',
        expectedRequestedQuantity: 2,
        expectedUnit: 'liter',
      },
    });

    expect(groceryService.updateItem).toHaveBeenCalledWith(item.id, {
      quantityMode: 'increment',
      quantity: 1,
      unit: 'liter',
      expectedRequestedQuantity: 2,
      expectedUnit: 'liter',
    });
    expect(result.structuredContent).toMatchObject({
      id: item.id,
      requestedQuantity: 3,
    });
  });

  it('preserves current item state in a stale update tool error', async () => {
    groceryService.updateItem.mockRejectedValue(
      new ConflictException({
        code: 'GROCERY_ITEM_CHANGED',
        message: `Grocery list item ${item.id} changed`,
        currentItem: { ...item, requestedQuantity: 5 },
      }),
    );

    const result = await client.callTool({
      name: 'grocery_update',
      arguments: {
        id: item.id,
        quantityMode: 'increment',
        quantity: 1,
        expectedRequestedQuantity: 2,
        expectedUnit: 'liter',
      },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text as string)).toMatchObject({
      code: 'GROCERY_ITEM_CHANGED',
      currentItem: { id: item.id, requestedQuantity: 5 },
    });
  });

  it('adds an item with an adapter-owned source and structured output', async () => {
    groceryService.addItem.mockResolvedValue({
      outcome: AddGroceryItemOutcome.created,
      createdItem: item,
      existingItems: [],
      requestedAddition: {
        requestedQuantity: 2,
        unit: 'liter',
        note: null,
      },
    });

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
      source: GroceryItemSource.mcp,
    });
    expect(result.structuredContent).toEqual({
      outcome: 'created',
      createdItem: {
        ...item,
        dateAdded: item.dateAdded.toISOString(),
      },
      existingItems: [],
      requestedAddition: {
        requestedQuantity: 2,
        unit: 'liter',
        note: null,
      },
    });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent) },
    ]);
  });

  it('returns confirmation details without retrying a duplicate add', async () => {
    groceryService.addItem.mockResolvedValue({
      outcome: AddGroceryItemOutcome.confirmation_required,
      createdItem: null,
      existingItems: [item],
      requestedAddition: {
        requestedQuantity: 1,
        unit: null,
        note: null,
      },
    });

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: { productName: 'milk', requestedQuantity: 1 },
    });

    expect(groceryService.addItem).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      outcome: 'confirmation_required',
      createdItem: null,
      existingItems: [{ id: item.id }],
      requestedAddition: { requestedQuantity: 1 },
    });
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
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'grocery_remove',
      errorType: 'domain_error',
    });
  });

  it('rejects malformed input without invoking the service', async () => {
    const result = await client.callTool({
      name: 'grocery_add',
      arguments: { productName: '', requestedQuantity: 0 },
    });

    expect(result.isError).toBe(true);
    expect(groceryService.addItem).not.toHaveBeenCalled();
  });

  it.each([
    ['grocery_add', { productName: 'milk', source: 'api' }],
    [
      'record_purchase',
      {
        productId: item.productId,
        eventType: InventoryEventType.PURCHASED,
        source: 'api',
      },
    ],
    [
      'record_stock_signal',
      {
        productId: item.productId,
        eventType: InventoryEventType.STOCK_LOW,
        source: 'api',
      },
    ],
    ['complete_grocery_purchase', { groceryItemIds: [item.id], source: 'api' }],
  ])('rejects a client-supplied source for %s', async (name, args) => {
    const result = await client.callTool({ name, arguments: args });

    expect(result.isError).toBe(true);
    expect(groceryService.addItem).not.toHaveBeenCalled();
    expect(inventoryService.recordPurchase).not.toHaveBeenCalled();
    expect(inventoryService.recordEvent).not.toHaveBeenCalled();
    expect(inventoryService.completeGroceryPurchase).not.toHaveBeenCalled();
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

  it('returns one stable validation failure for missing or ambiguous selectors', async () => {
    const missingSelector = await client.callTool({
      name: 'get_product',
      arguments: {},
    });
    const ambiguousSelector = await client.callTool({
      name: 'get_product',
      arguments: { id: item.productId, productName: 'milk' },
    });

    expect(missingSelector.isError).toBe(true);
    expect(ambiguousSelector.isError).toBe(true);
    expect(missingSelector.content).toEqual(ambiguousSelector.content);
    expect(missingSelector.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining(
          'Provide exactly one of id or productName',
        ),
      },
    ]);
    expect(productService.findOne).not.toHaveBeenCalled();
    expect(productService.findByExactOrAliasName).not.toHaveBeenCalled();
  });

  it('rejects a blank product name before service invocation', async () => {
    const result = await client.callTool({
      name: 'get_product',
      arguments: { productName: '' },
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
      source: 'mcp',
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
      source: 'mcp',
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

  it('completes selected grocery items with MCP provenance', async () => {
    const secondItem = {
      ...item,
      id: '00000000-0000-4000-8000-000000000004',
      productId: '00000000-0000-4000-8000-000000000005',
      productName: 'rice',
      status: GroceryItemStatus.purchased,
      relatedInventoryEventId: '00000000-0000-4000-8000-000000000006',
    };
    const completedItem = {
      ...item,
      status: GroceryItemStatus.purchased,
      relatedInventoryEventId: '00000000-0000-4000-8000-000000000003',
    };
    const events = [
      inventoryEvent(InventoryEventType.PURCHASED),
      {
        ...inventoryEvent(InventoryEventType.PURCHASED),
        id: secondItem.relatedInventoryEventId,
        productId: secondItem.productId,
      },
    ];
    inventoryService.completeGroceryPurchase.mockResolvedValue({
      events,
      completedItems: [completedItem, secondItem],
    });

    const result = await client.callTool({
      name: 'complete_grocery_purchase',
      arguments: { groceryItemIds: [completedItem.id, secondItem.id] },
    });

    expect(inventoryService.completeGroceryPurchase).toHaveBeenCalledWith({
      groceryItemIds: [completedItem.id, secondItem.id],
      source: 'mcp',
    });
    expect(result.structuredContent).toEqual({
      events: events.map((event) => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
      completedItems: [completedItem, secondItem].map((completed) => ({
        ...completed,
        dateAdded: completed.dateAdded.toISOString(),
      })),
    });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent) },
    ]);
  });

  it.each([
    {},
    { groceryItemIds: [] },
    { groceryItemIds: ['not-a-uuid'] },
    { groceryItemIds: [item.id, item.id] },
    { groceryItemIds: [item.id], productId: item.productId },
  ])(
    'rejects invalid completion input before service invocation',
    async (args) => {
      const result = await client.callTool({
        name: 'complete_grocery_purchase',
        arguments: args,
      });

      expect(result.isError).toBe(true);
      expect(inventoryService.completeGroceryPurchase).not.toHaveBeenCalled();
    },
  );

  it('sanitizes unexpected grocery completion failures', async () => {
    inventoryService.completeGroceryPurchase.mockRejectedValue(
      new Error('database password leaked here'),
    );

    const result = await client.callTool({
      name: 'complete_grocery_purchase',
      arguments: { groceryItemIds: [item.id] },
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
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'complete_grocery_purchase',
      errorType: 'unexpected_error',
    });
    expect(
      JSON.stringify(operationalLogger.mcpIntegration.mock.calls),
    ).not.toContain('database password leaked here');
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
    source: 'mcp',
    confidence: null,
    metadata: null,
  };
}
