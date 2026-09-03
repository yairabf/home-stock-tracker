import { ConflictException, NotFoundException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  FeedbackStatus,
  GroceryItemSource,
  GroceryItemStatus,
  ProductNameKind,
} from '../generated/prisma/enums';
import { GroceryService } from '../grocery/grocery.service';
import {
  McpServerFactory,
  PUBLISHED_INVENTORY_EVENT_TYPES,
} from './mcp-server.factory';
import { ProductService } from '../product/product.service';
import { ProductSearchService } from '../product/product-search.service';
import type { PredictionEngine } from '../estimation/prediction-engine';
import { PredictedState } from '../generated/prisma/enums';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryEventType } from '../generated/prisma/enums';
import { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';
import { OperationalLogger } from '../observability/operational-logger.service';
import { PredictionFeedbackService } from '../inventory/prediction-feedback.service';
import { PredictionFeedbackOutcome } from '../inventory/dto/prediction-feedback.dto';
import {
  PendingGroceryItemPolicy,
  ProductResolutionAction,
  UnknownProductPolicy,
} from '../grocery/types/policy-aware-grocery-addition';
import { MCP_SERVER_INFO } from './agent-release-contract.generated';
import { HouseholdService } from '../household/household.service';

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
    Pick<
      GroceryService,
      | 'addPolicyAwareItem'
      | 'confirmNewProduct'
      | 'confirmProductAlias'
      | 'setQuantity'
      | 'updateItem'
      | 'removeItem'
      | 'listItems'
    >
  >;
  let client: Client;
  let closeServer: () => Promise<void>;
  let productService: jest.Mocked<
    Pick<ProductService, 'addAlias' | 'findOne' | 'findByExactOrAliasName'>
  >;
  let productSearchService: jest.Mocked<Pick<ProductSearchService, 'search'>>;
  let predictionEngine: jest.Mocked<PredictionEngine>;
  let inventoryService: jest.Mocked<
    Pick<
      InventoryService,
      | 'recordPurchase'
      | 'recordPurchases'
      | 'updateStock'
      | 'recordEvent'
      | 'listEvents'
      | 'completeGroceryPurchase'
    >
  >;
  let recommendationService: jest.Mocked<
    Pick<LowStockRecommendationService, 'getRecommendations'>
  >;
  let predictionFeedbackService: jest.Mocked<
    Pick<PredictionFeedbackService, 'submitFeedback'>
  >;
  let operationalLogger: jest.Mocked<Pick<OperationalLogger, 'mcpIntegration'>>;
  let householdService: jest.Mocked<Pick<HouseholdService, 'getContext'>>;

  beforeEach(async () => {
    groceryService = {
      addPolicyAwareItem: jest.fn(),
      confirmNewProduct: jest.fn(),
      confirmProductAlias: jest.fn(),
      setQuantity: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      listItems: jest.fn(),
    };
    productService = {
      addAlias: jest.fn(),
      findOne: jest.fn(),
      findByExactOrAliasName: jest.fn(),
    };
    productSearchService = { search: jest.fn() };
    predictionEngine = { predictProduct: jest.fn() };
    inventoryService = {
      recordPurchase: jest.fn(),
      recordPurchases: jest.fn(),
      updateStock: jest.fn(),
      recordEvent: jest.fn(),
      listEvents: jest.fn(),
      completeGroceryPurchase: jest.fn(),
    };
    recommendationService = { getRecommendations: jest.fn() };
    predictionFeedbackService = { submitFeedback: jest.fn() };
    householdService = { getContext: jest.fn() };
    operationalLogger = { mcpIntegration: jest.fn() };
    const factory = new McpServerFactory(
      groceryService as GroceryService,
      productService as ProductService,
      productSearchService as ProductSearchService,
      predictionEngine,
      inventoryService as InventoryService,
      predictionFeedbackService as PredictionFeedbackService,
      recommendationService as LowStockRecommendationService,
      householdService as HouseholdService,
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

  it('discovers the grocery tools with strict schemas', async () => {
    expect(client.getServerVersion()).toMatchObject(MCP_SERVER_INFO);
    const result = await client.listTools();

    expect(result.tools.map(({ name }) => name)).toEqual([
      'grocery_add',
      'grocery_confirm_new_product',
      'grocery_confirm_product_alias',
      'grocery_set_quantity',
      'grocery_update',
      'grocery_remove',
      'grocery_list',
      'get_household_context',
      'get_product',
      'search_products',
      'get_inventory',
      'list_inventory_events',
      'product_add_alias',
      'record_purchase',
      'update_inventory',
      'record_purchases',
      'record_stock_signal',
      'record_prediction_feedback',
      'complete_grocery_purchase',
      'get_low_stock_predictions',
    ]);
    expect(
      result.tools.find(({ name }) => name === 'grocery_add')?.description,
    ).toContain('propose_if_missing');
    const groceryAddTool = result.tools.find(
      ({ name }) => name === 'grocery_add',
    );
    expect(groceryAddTool?.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ['groceryItem'],
      properties: {
        unknownProductPolicy: {
          default: 'propose_if_missing',
          enum: ['create_if_missing', 'propose_if_missing'],
        },
        productName: { type: 'string' },
        product: { type: 'object' },
        groceryItem: { type: 'object' },
      },
    });
    expect(JSON.stringify(groceryAddTool?.outputSchema)).toContain(
      'product_resolution_required',
    );
    const predictionFeedbackTool = result.tools.find(
      ({ name }) => name === 'record_prediction_feedback',
    );
    expect(predictionFeedbackTool).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['predictionId', 'outcome'],
        properties: {
          predictionId: { type: 'string', format: 'uuid' },
          outcome: { enum: ['accepted', 'rejected', 'corrected'] },
          correctedState: {
            enum: ['likely_available', 'probably_low', 'probably_out'],
          },
        },
      },
      outputSchema: {
        properties: {
          feedbackStatus: { enum: ['accepted', 'rejected'] },
          correctedState: {},
        },
      },
    });
    const confirmNewProduct = result.tools.find(
      ({ name }) => name === 'grocery_confirm_new_product',
    );
    expect(confirmNewProduct?.description).toContain('user-approved final');
    expect(confirmNewProduct).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['product', 'groceryItem'],
        properties: {
          product: { type: 'object' },
          groceryItem: { type: 'object' },
        },
      },
    });
    expect(JSON.stringify(confirmNewProduct?.outputSchema)).not.toContain(
      'product_resolution_required',
    );
    const confirmAlias = result.tools.find(
      ({ name }) => name === 'grocery_confirm_product_alias',
    );
    expect(confirmAlias?.description).toContain('exact target product ID');
    expect(confirmAlias).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['targetProductId', 'alias', 'groceryItem'],
        properties: {
          targetProductId: { type: 'string', format: 'uuid' },
          alias: { type: 'string' },
          groceryItem: { type: 'object' },
        },
      },
    });
    const setQuantityTool = result.tools.find(
      ({ name }) => name === 'grocery_set_quantity',
    );
    expect(setQuantityTool?.description).toContain('absolute final quantity');
    expect(setQuantityTool).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['itemId', 'requestedQuantity', 'expectedRequestedQuantity'],
        properties: {
          itemId: { type: 'string', format: 'uuid' },
          requestedQuantity: { type: 'number', exclusiveMinimum: 0 },
          expectedRequestedQuantity: {
            type: 'number',
            exclusiveMinimum: 0,
          },
        },
      },
      outputSchema: {
        properties: {
          requestedQuantity: {
            type: 'number',
            exclusiveMinimum: 0,
          },
        },
      },
    });
    expect(setQuantityTool?.outputSchema?.required).toContain(
      'requestedQuantity',
    );
    const updateTool = result.tools.find(
      ({ name }) => name === 'grocery_update',
    );
    expect(updateTool?.description).toContain(
      'Prefer grocery_set_quantity for quantity-only changes',
    );
    expect(updateTool?.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        requestedQuantity: { type: 'number', exclusiveMinimum: 0 },
        expectedRequestedQuantity: {
          type: 'number',
          exclusiveMinimum: 0,
        },
        unit: {},
        expectedUnit: {},
        note: {},
        expectedNote: {},
      },
    });
    expect(
      result.tools.find(({ name }) => name === 'grocery_remove')?.inputSchema,
    ).toMatchObject({
      additionalProperties: false,
      required: ['id'],
    });
    const householdContextTool = result.tools.find(
      ({ name }) => name === 'get_household_context',
    );
    expect(householdContextTool?.description).toContain(
      'explicit setup, configuration, or prediction-explanation questions',
    );
    expect(householdContextTool?.description).toContain(
      'Do not call before routine predictions or recommendations',
    );
    expect(householdContextTool).toMatchObject({
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
      outputSchema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'adultsCount',
          'childrenCount',
          'childAgeGroups',
          'predictionPreferences',
          'suggestionConfidenceThreshold',
          'productPolicies',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          adultsCount: { type: 'integer', minimum: 0 },
          childrenCount: { type: 'integer', minimum: 0 },
          childAgeGroups: { type: 'array' },
          suggestionConfidenceThreshold: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
        },
      },
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
    const searchTool = result.tools.find(
      ({ name }) => name === 'search_products',
    );
    expect(searchTool?.description).toContain(
      'Present multiple plausible candidates to the user instead of silently choosing one',
    );
    expect(searchTool?.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 20 },
      },
    });
    const eventHistoryTool = result.tools.find(
      ({ name }) => name === 'list_inventory_events',
    );
    expect(eventHistoryTool?.description).toContain(
      'history, not an estimate of current stock',
    );
    expect(eventHistoryTool?.inputSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        productId: { type: 'string', format: 'uuid' },
        eventType: {
          type: 'string',
          enum: PUBLISHED_INVENTORY_EVENT_TYPES,
        },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    });
    expect(eventHistoryTool?.outputSchema).toMatchObject({
      properties: {
        items: {
          type: 'array',
          items: {
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              productId: { type: 'string' },
              eventType: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        total: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0 },
      },
    });
    expect(JSON.stringify(eventHistoryTool?.outputSchema)).not.toContain(
      '"metadata"',
    );
    const productAddAliasTool = result.tools.find(
      ({ name }) => name === 'product_add_alias',
    );
    expect(productAddAliasTool?.description).toContain('explicit confirmation');
    expect(productAddAliasTool?.description).toContain(
      'Do not infer the target',
    );
    expect(productAddAliasTool).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['productId', 'alias'],
        properties: {
          productId: { type: 'string', format: 'uuid' },
          alias: { type: 'string', minLength: 1 },
        },
      },
      outputSchema: {
        properties: {
          id: { type: 'string' },
          canonicalName: { type: 'string' },
          aliases: { type: 'array' },
        },
      },
    });
    const purchaseCompletionTool = result.tools.find(
      ({ name }) => name === 'complete_grocery_purchase',
    );
    expect(purchaseCompletionTool?.description).toContain(
      'only user-supplied actual measurements',
    );
    expect(purchaseCompletionTool?.inputSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        groceryItemIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['groceryItemId'],
            properties: {
              groceryItemId: { type: 'string', format: 'uuid' },
              actualQuantity: { type: 'number', exclusiveMinimum: 0 },
              actualUnit: { type: 'string', minLength: 1 },
            },
          },
        },
      },
    });
    const updateInventoryTool = result.tools.find(
      ({ name }) => name === 'update_inventory',
    );
    expect(updateInventoryTool).toMatchObject({
      inputSchema: {
        type: 'object',
      },
      outputSchema: {
        properties: {
          event: { type: 'object' },
          stock: {
            type: 'object',
            properties: {
              recordedQuantity: {},
              estimatedState: { enum: Object.values(PredictedState) },
              evaluatedAt: { type: 'string' },
            },
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
    expect(JSON.stringify(updateInventoryTool?.inputSchema)).toContain(
      'additionalProperties',
    );
    expect(updateInventoryTool?.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ['productId', 'operation'],
      properties: {
        productId: { type: 'string', format: 'uuid' },
        operation: { enum: ['set', 'decrement', 'mark_out'] },
        quantity: { type: 'number', exclusiveMinimum: 0 },
        unit: { type: 'string', minLength: 1 },
      },
    });
    const recordPurchasesTool = result.tools.find(
      ({ name }) => name === 'record_purchases',
    );
    expect(recordPurchasesTool).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['items'],
        properties: {
          purchasedAt: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'object', additionalProperties: false },
          },
        },
      },
      outputSchema: {
        properties: { items: { type: 'array' } },
      },
    });
    for (const name of [
      'grocery_add',
      'grocery_confirm_new_product',
      'grocery_confirm_product_alias',
      'product_add_alias',
      'record_purchase',
      'update_inventory',
      'record_purchases',
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

  it('sets an absolute quantity with structured output', async () => {
    groceryService.setQuantity.mockResolvedValue({
      ...item,
      requestedQuantity: 4,
    });

    const result = await client.callTool({
      name: 'grocery_set_quantity',
      arguments: {
        itemId: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      },
    });

    expect(groceryService.setQuantity).toHaveBeenCalledWith(item.id, {
      requestedQuantity: 4,
      expectedRequestedQuantity: 2,
    });
    expect(result.structuredContent).toMatchObject({
      id: item.id,
      requestedQuantity: 4,
      unit: 'liter',
    });
  });

  it('preserves current item state in a stale quantity error', async () => {
    groceryService.setQuantity.mockRejectedValue(
      new ConflictException({
        code: 'GROCERY_ITEM_CHANGED',
        message: `Grocery list item ${item.id} changed`,
        currentItem: { ...item, requestedQuantity: 5 },
      }),
    );

    const result = await client.callTool({
      name: 'grocery_set_quantity',
      arguments: {
        itemId: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      },
    });

    expect(groceryService.setQuantity).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(JSON.parse(content[0].text ?? '') as unknown).toMatchObject({
      code: 'GROCERY_ITEM_CHANGED',
      currentItem: { id: item.id, requestedQuantity: 5 },
    });
  });

  it.each([
    ['missing item ID', { requestedQuantity: 4, expectedRequestedQuantity: 2 }],
    [
      'missing final quantity',
      { itemId: item.id, expectedRequestedQuantity: 2 },
    ],
    ['missing expected quantity', { itemId: item.id, requestedQuantity: 4 }],
    [
      'extra input',
      {
        itemId: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
        increment: 1,
      },
    ],
    [
      'zero final quantity',
      {
        itemId: item.id,
        requestedQuantity: 0,
        expectedRequestedQuantity: 2,
      },
    ],
    [
      'negative expected quantity',
      {
        itemId: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: -1,
      },
    ],
    [
      'NaN final quantity',
      {
        itemId: item.id,
        requestedQuantity: Number.NaN,
        expectedRequestedQuantity: 2,
      },
    ],
    [
      'positive infinity',
      {
        itemId: item.id,
        requestedQuantity: Number.POSITIVE_INFINITY,
        expectedRequestedQuantity: 2,
      },
    ],
    [
      'negative infinity',
      {
        itemId: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: Number.NEGATIVE_INFINITY,
      },
    ],
  ])('rejects %s without invoking quantity setting', async (_, arguments_) => {
    const result = await client.callTool({
      name: 'grocery_set_quantity',
      arguments: arguments_,
    });

    expect(result.isError).toBe(true);
    expect(groceryService.setQuantity).not.toHaveBeenCalled();
  });

  it('updates final fields with expected values and structured output', async () => {
    groceryService.updateItem.mockResolvedValue({
      ...item,
      requestedQuantity: 4,
      note: 'lactose-free',
    });

    const result = await client.callTool({
      name: 'grocery_update',
      arguments: {
        id: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
        note: 'lactose-free',
        expectedNote: null,
      },
    });

    expect(groceryService.updateItem).toHaveBeenCalledWith(item.id, {
      requestedQuantity: 4,
      expectedRequestedQuantity: 2,
      note: 'lactose-free',
      expectedNote: null,
    });
    expect(result.structuredContent).toMatchObject({
      id: item.id,
      requestedQuantity: 4,
      note: 'lactose-free',
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
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0].type).toBe('text');
    expect(JSON.parse(content[0].text ?? '') as unknown).toMatchObject({
      code: 'GROCERY_ITEM_CHANGED',
      currentItem: { id: item.id, requestedQuantity: 5 },
    });
  });

  it('adds an item with an adapter-owned source and structured output', async () => {
    groceryService.addPolicyAwareItem.mockResolvedValue({
      outcome: 'created',
      createdItem: item,
      existingItems: [],
      requestedAddition: {
        productName: 'milk',
        requestedQuantity: 2,
        unit: 'liter',
        note: null,
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
    });

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: {
        productName: ' milk ',
        groceryItem: { requestedQuantity: 2, unit: 'liter' },
      },
    });

    expect(groceryService.addPolicyAwareItem).toHaveBeenCalledWith({
      unknownProductPolicy: UnknownProductPolicy.propose_if_missing,
      productName: 'milk',
      groceryItem: {
        requestedQuantity: 2,
        unit: 'liter',
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
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
        productName: 'milk',
        requestedQuantity: 2,
        unit: 'liter',
        note: null,
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
    });
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent) },
    ]);
  });

  it('confirms products and aliases with MCP-owned source', async () => {
    groceryService.confirmNewProduct.mockResolvedValue({
      outcome: 'created',
      createdItem: { ...item, source: GroceryItemSource.mcp },
      existingItems: [],
      requestedAddition: {
        productName: 'Milk',
        requestedQuantity: 2,
        unit: null,
        note: null,
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
    });
    groceryService.confirmProductAlias.mockResolvedValue({
      outcome: 'confirmation_required',
      createdItem: null,
      existingItems: [item],
      requestedAddition: {
        productName: 'Whole Milk',
        requestedQuantity: 2,
        unit: null,
        note: null,
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
    });
    const productInput = {
      canonicalName: 'Milk',
      aliases: [],
      category: 'dairy',
      typicalUnit: 'carton',
      productType: 'fast_consumable',
      isPerishable: true,
    };

    const createResult = await client.callTool({
      name: 'grocery_confirm_new_product',
      arguments: {
        product: productInput,
        groceryItem: { requestedQuantity: 2 },
      },
    });
    const aliasResult = await client.callTool({
      name: 'grocery_confirm_product_alias',
      arguments: {
        targetProductId: item.productId,
        alias: 'Whole Milk',
        groceryItem: { requestedQuantity: 2 },
      },
    });

    expect(groceryService.confirmNewProduct).toHaveBeenCalledWith({
      product: productInput,
      groceryItem: { requestedQuantity: 2 },
      source: GroceryItemSource.mcp,
    });
    expect(groceryService.confirmProductAlias).toHaveBeenCalledWith({
      targetProductId: item.productId,
      alias: 'Whole Milk',
      groceryItem: { requestedQuantity: 2 },
      source: GroceryItemSource.mcp,
    });
    expect(createResult.structuredContent).toMatchObject({
      outcome: 'created',
    });
    expect(aliasResult.structuredContent).toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ id: item.id }],
    });
  });

  it('returns confirmation details without retrying a duplicate add', async () => {
    groceryService.addPolicyAwareItem.mockResolvedValue({
      outcome: 'confirmation_required',
      createdItem: null,
      existingItems: [item],
      requestedAddition: {
        productName: 'milk',
        requestedQuantity: 1,
        unit: null,
        note: null,
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
    });

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: {
        productName: 'milk',
        groceryItem: { requestedQuantity: 1 },
      },
    });

    expect(groceryService.addPolicyAwareItem).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      outcome: 'confirmation_required',
      createdItem: null,
      existingItems: [{ id: item.id }],
      requestedAddition: { requestedQuantity: 1 },
    });
  });

  it('returns product resolution as a successful structured outcome', async () => {
    groceryService.addPolicyAwareItem.mockResolvedValue({
      outcome: 'product_resolution_required',
      requestedAddition: {
        productName: 'milky thing',
        requestedQuantity: null,
        unit: null,
        note: null,
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
      candidates: [],
      proposal: null,
      allowedActions: [
        ProductResolutionAction.create_product,
        ProductResolutionAction.cancel,
      ],
    });

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: { productName: 'milky thing', groceryItem: {} },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      outcome: 'product_resolution_required',
      allowedActions: ['create_product', 'cancel'],
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

  it('returns the configured household context without extra fields', async () => {
    const context = {
      id: '00000000-0000-4000-8000-000000000010',
      adultsCount: 2,
      childrenCount: 3,
      childAgeGroups: ['child', 'teen'],
      predictionPreferences: { preferRecentSignals: true },
      suggestionConfidenceThreshold: 0.8,
      productPolicies: null,
    };
    householdService.getContext.mockResolvedValue(context);

    const result = await client.callTool({
      name: 'get_household_context',
      arguments: {},
    });

    expect(householdService.getContext).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toEqual(context);
  });

  it('rejects household context arguments without reading', async () => {
    const result = await client.callTool({
      name: 'get_household_context',
      arguments: { householdId: item.productId },
    });

    expect(result.isError).toBe(true);
    expect(householdService.getContext).not.toHaveBeenCalled();
  });

  it('returns a safe missing-household error', async () => {
    householdService.getContext.mockRejectedValue(
      new NotFoundException('Household is not configured'),
    );

    const result = await client.callTool({
      name: 'get_household_context',
      arguments: {},
    });

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Household is not configured' }],
    });
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'get_household_context',
      errorType: 'domain_error',
    });
  });

  it('sanitizes unexpected household context failures', async () => {
    householdService.getContext.mockRejectedValue(
      new Error('database credential leaked'),
    );

    const result = await client.callTool({
      name: 'get_household_context',
      arguments: {},
    });

    expect(result).toMatchObject({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'The inventory operation could not be completed',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('database credential leaked');
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'get_household_context',
      errorType: 'unexpected_error',
    });
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
    expect(groceryService.addPolicyAwareItem).not.toHaveBeenCalled();
  });

  it.each([
    ['grocery_add', { productName: 'milk', groceryItem: {}, source: 'api' }],
    [
      'grocery_confirm_new_product',
      {
        product: {
          canonicalName: 'Milk',
          aliases: [],
          category: 'dairy',
          typicalUnit: null,
          productType: 'fast_consumable',
          isPerishable: true,
        },
        groceryItem: {},
        source: 'api',
      },
    ],
    [
      'grocery_confirm_product_alias',
      {
        targetProductId: item.productId,
        alias: 'Whole Milk',
        groceryItem: {},
        proposalId: 'proposal-1',
      },
    ],
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
    expect(groceryService.addPolicyAwareItem).not.toHaveBeenCalled();
    expect(groceryService.confirmNewProduct).not.toHaveBeenCalled();
    expect(groceryService.confirmProductAlias).not.toHaveBeenCalled();
    expect(inventoryService.recordPurchase).not.toHaveBeenCalled();
    expect(inventoryService.updateStock).not.toHaveBeenCalled();
    expect(inventoryService.recordPurchases).not.toHaveBeenCalled();
    expect(inventoryService.recordEvent).not.toHaveBeenCalled();
    expect(inventoryService.completeGroceryPurchase).not.toHaveBeenCalled();
  });

  it('searches products with normalized input and compact ordered output', async () => {
    productSearchService.search.mockResolvedValue({
      exactMatch: null,
      candidates: [
        {
          id: 'product-b',
          canonicalName: 'Milk B',
          aliases: ['B Milk'],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: null,
          isPerishable: true,
          predictionEnabled: false,
        },
        {
          id: 'product-a',
          canonicalName: 'Milk A',
          aliases: [],
          category: null,
          typicalUnit: null,
          productType: null,
          isPerishable: false,
          predictionEnabled: true,
        },
      ],
    });

    const result = await client.callTool({
      name: 'search_products',
      arguments: { query: '  ＭＩＬＫ  ', limit: 2 },
    });

    expect(productSearchService.search).toHaveBeenCalledWith({
      query: 'milk',
      limit: 2,
    });
    expect(result.structuredContent).toEqual({
      exactMatch: null,
      candidates: [
        {
          id: 'product-b',
          canonicalName: 'Milk B',
          aliases: ['B Milk'],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: null,
          isPerishable: true,
          predictionEnabled: false,
        },
        {
          id: 'product-a',
          canonicalName: 'Milk A',
          aliases: [],
          category: null,
          typicalUnit: null,
          productType: null,
          isPerishable: false,
          predictionEnabled: true,
        },
      ],
    });
  });

  it.each([
    [{ query: '' }],
    [{ query: 'x'.repeat(201) }],
    [{ query: 'milk', limit: 21 }],
    [{ query: 'milk', unexpected: true }],
  ])('rejects invalid product search input: %j', async (argumentsValue) => {
    const result = await client.callTool({
      name: 'search_products',
      arguments: argumentsValue,
    });

    expect(result.isError).toBe(true);
    expect(productSearchService.search).not.toHaveBeenCalled();
  });

  it('gets a product by UUID with the existing response contract', async () => {
    productService.findOne.mockResolvedValue({
      id: item.productId,
      names: [
        {
          id: 'name-canonical',
          productId: item.productId,
          displayName: 'milk',
          normalizedName: 'milk',
          kind: ProductNameKind.canonical,
        },
        {
          id: 'name-alias',
          productId: item.productId,
          displayName: 'whole milk',
          normalizedName: 'whole milk',
          kind: ProductNameKind.alias,
        },
      ],
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
      names: [
        {
          id: 'name-canonical',
          productId: item.productId,
          displayName: 'milk',
          normalizedName: 'milk',
          kind: ProductNameKind.canonical,
        },
        {
          id: 'name-alias',
          productId: item.productId,
          displayName: 'whole milk',
          normalizedName: 'whole milk',
          kind: ProductNameKind.alias,
        },
      ],
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

  it('adds a confirmed standalone alias through the shared product service', async () => {
    productService.addAlias.mockResolvedValue({
      id: item.productId,
      names: [
        {
          id: 'name-canonical',
          productId: item.productId,
          displayName: 'Milk',
          normalizedName: 'milk',
          kind: ProductNameKind.canonical,
        },
        {
          id: 'name-alias',
          productId: item.productId,
          displayName: 'Whole Milk',
          normalizedName: 'whole milk',
          kind: ProductNameKind.alias,
        },
      ],
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
      name: 'product_add_alias',
      arguments: { productId: item.productId, alias: '  Whole Milk  ' },
    });

    expect(productService.addAlias).toHaveBeenCalledWith(item.productId, {
      alias: 'Whole Milk',
    });
    expect(productService.addAlias).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({
      id: item.productId,
      canonicalName: 'Milk',
      aliases: ['Whole Milk'],
    });
    expect(groceryService.confirmProductAlias).not.toHaveBeenCalled();
  });

  it.each([
    ['missing product ID', { alias: 'Whole Milk' }],
    ['malformed product ID', { productId: 'not-a-uuid', alias: 'Whole Milk' }],
    ['missing alias', { productId: item.productId }],
    ['blank alias', { productId: item.productId, alias: '   ' }],
    [
      'unknown field',
      { productId: item.productId, alias: 'Whole Milk', source: 'api' },
    ],
  ])('rejects standalone alias %s before mutation', async (_case, args) => {
    const result = await client.callTool({
      name: 'product_add_alias',
      arguments: args,
    });

    expect(result.isError).toBe(true);
    expect(productService.addAlias).not.toHaveBeenCalled();
  });

  it('returns standalone alias domain conflicts as safe tool errors', async () => {
    productService.addAlias.mockRejectedValue(
      new ConflictException({
        code: 'PRODUCT_NAME_CONFLICT',
        message: 'A product name is already assigned to another product',
      }),
    );

    const result = await client.callTool({
      name: 'product_add_alias',
      arguments: { productId: item.productId, alias: 'Whole Milk' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'PRODUCT_NAME_CONFLICT: A product name is already assigned to another product',
      },
    ]);
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'product_add_alias',
      errorType: 'domain_error',
    });
  });

  it('sanitizes unexpected standalone alias failures', async () => {
    productService.addAlias.mockRejectedValue(
      new Error('database password leaked here'),
    );

    const result = await client.callTool({
      name: 'product_add_alias',
      arguments: { productId: item.productId, alias: 'Whole Milk' },
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
      tool: 'product_add_alias',
      errorType: 'unexpected_error',
    });
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
    const content = missingSelector.content as Array<{
      type: string;
      text?: string;
    }>;
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain(
      'Provide exactly one of id or productName',
    );
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

    expect(predictionEngine.predictProduct.mock.calls).toEqual([
      [item.productId],
    ]);
    expect(result.structuredContent).toMatchObject({
      productId: item.productId,
      predictedState: PredictedState.uncertain,
      deterministicSignals: { coldStart: true, eventCount: 0 },
    });
    expect(result.structuredContent).not.toHaveProperty('quantity');
  });

  it('lists filtered inventory history without exposing metadata', async () => {
    const event = {
      ...inventoryEvent(InventoryEventType.PURCHASED),
      metadata: { privateNote: 'do not expose' },
    };
    inventoryService.listEvents.mockResolvedValue({
      items: [event],
      total: 7,
      limit: 5,
      offset: 10,
    });

    const result = await client.callTool({
      name: 'list_inventory_events',
      arguments: {
        productId: item.productId,
        eventType: InventoryEventType.PURCHASED,
        limit: 5,
        offset: 10,
      },
    });

    expect(inventoryService.listEvents).toHaveBeenCalledWith({
      productId: item.productId,
      eventType: InventoryEventType.PURCHASED,
      limit: 5,
      offset: 10,
    });
    expect(result.structuredContent).toEqual({
      items: [
        {
          id: event.id,
          productId: event.productId,
          eventType: event.eventType,
          quantity: event.quantity,
          unit: event.unit,
          timestamp: event.timestamp.toISOString(),
          source: event.source,
          confidence: event.confidence,
        },
      ],
      total: 7,
      limit: 5,
      offset: 10,
    });
    expect(result.structuredContent).not.toHaveProperty('items.0.metadata');
  });

  it('applies history pagination defaults and returns an empty page', async () => {
    inventoryService.listEvents.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const result = await client.callTool({
      name: 'list_inventory_events',
      arguments: {},
    });

    expect(inventoryService.listEvents).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
    });
    expect(result.structuredContent).toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  it.each([
    ['product', { productId: item.productId }],
    ['event type', { eventType: InventoryEventType.STOCK_OUT }],
  ])('supports an independent %s history filter', async (_case, filter) => {
    inventoryService.listEvents.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    await client.callTool({
      name: 'list_inventory_events',
      arguments: filter,
    });

    expect(inventoryService.listEvents).toHaveBeenCalledWith({
      ...filter,
      limit: 20,
      offset: 0,
    });
  });

  it.each([
    ['malformed product ID', { productId: 'not-a-uuid' }],
    ['unknown event type', { eventType: 'UNKNOWN' }],
    ['zero limit', { limit: 0 }],
    ['fractional limit', { limit: 1.5 }],
    ['limit above maximum', { limit: 101 }],
    ['fractional offset', { offset: 1.5 }],
    ['negative offset', { offset: -1 }],
    ['unknown field', { includeMetadata: true }],
  ])(
    'rejects %s before listing inventory history',
    async (_case, arguments_) => {
      const result = await client.callTool({
        name: 'list_inventory_events',
        arguments: arguments_,
      });

      expect(result.isError).toBe(true);
      expect(inventoryService.listEvents).not.toHaveBeenCalled();
    },
  );

  it('sanitizes unexpected inventory-history failures', async () => {
    inventoryService.listEvents.mockRejectedValue(
      new Error('database password leaked here'),
    );

    const result = await client.callTool({
      name: 'list_inventory_events',
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
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'list_inventory_events',
      errorType: 'unexpected_error',
    });
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
    expect(productService.findOne.mock.calls).toHaveLength(0);
    expect(predictionEngine.predictProduct.mock.calls).toHaveLength(0);
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
        purchasedAt: '2026-08-26T12:00:00.000Z',
      },
    });

    expect(inventoryService.recordPurchase).toHaveBeenCalledWith({
      productId: item.productId,
      eventType: InventoryEventType.PURCHASED,
      quantity: 2,
      unit: 'liter',
      metadata: { store: 'market' },
      purchasedAt: '2026-08-26T12:00:00.000Z',
      source: 'mcp',
    });
    expect(result.structuredContent).toEqual({
      ...event,
      timestamp: event.timestamp.toISOString(),
    });
  });

  it('rejects a timezone-free record_purchase timestamp before service invocation', async () => {
    const result = await client.callTool({
      name: 'record_purchase',
      arguments: {
        productId: item.productId,
        eventType: InventoryEventType.PURCHASED,
        purchasedAt: '2026-08-26T12:00:00',
      },
    });

    expect(result.isError).toBe(true);
    expect(inventoryService.recordPurchase).not.toHaveBeenCalled();
  });

  it('updates inventory with MCP provenance and a structured receipt', async () => {
    const receipt = stockMutationReceipt(InventoryEventType.STOCK_SET);
    inventoryService.updateStock.mockResolvedValue(receipt);

    const result = await client.callTool({
      name: 'update_inventory',
      arguments: {
        productId: item.productId,
        operation: 'set',
        quantity: 4,
        unit: 'liter',
      },
    });

    expect(inventoryService.updateStock).toHaveBeenCalledWith({
      productId: item.productId,
      operation: 'set',
      quantity: 4,
      unit: 'liter',
      source: 'mcp',
    });
    expect(result.structuredContent).toEqual(
      JSON.parse(JSON.stringify(receipt)),
    );
  });

  it('records ordered batch purchases with MCP provenance and timestamp inheritance inputs', async () => {
    const first = stockMutationReceipt(InventoryEventType.PURCHASED);
    const second = stockMutationReceipt(InventoryEventType.PURCHASED, {
      productId: '00000000-0000-4000-8000-000000000004',
      eventId: '00000000-0000-4000-8000-000000000005',
    });
    inventoryService.recordPurchases.mockResolvedValue({
      items: [first, second],
    });
    const purchasedAt = '2026-08-25T12:00:00.000Z';
    const itemPurchasedAt = '2026-08-26T12:00:00+02:00';
    const items = [
      { productId: item.productId, quantity: 2 },
      {
        productId: second.event.productId,
        purchasedAt: itemPurchasedAt,
      },
    ];

    const result = await client.callTool({
      name: 'record_purchases',
      arguments: { purchasedAt, items },
    });

    expect(inventoryService.recordPurchases).toHaveBeenCalledWith({
      purchasedAt,
      items,
      source: 'mcp',
    });
    expect(
      (result.structuredContent as { items: Array<typeof first> }).items.map(
        ({ event }) => event.productId,
      ),
    ).toEqual([item.productId, second.event.productId]);
  });

  it.each([
    [
      'set without quantity',
      'update_inventory',
      {
        productId: item.productId,
        operation: 'set',
      },
    ],
    [
      'mark_out with fields',
      'update_inventory',
      {
        productId: item.productId,
        operation: 'mark_out',
        quantity: 1,
      },
    ],
    [
      'client source',
      'update_inventory',
      {
        productId: item.productId,
        operation: 'mark_out',
        source: 'api',
      },
    ],
    [
      'duplicate batch products',
      'record_purchases',
      {
        items: [{ productId: item.productId }, { productId: item.productId }],
      },
    ],
    [
      'timezone-free batch timestamp',
      'record_purchases',
      {
        purchasedAt: '2026-08-26T12:00:00',
        items: [{ productId: item.productId }],
      },
    ],
    [
      'unknown batch field',
      'record_purchases',
      {
        items: [{ productId: item.productId, eventType: 'PURCHASED' }],
      },
    ],
  ])(
    'rejects invalid %s input before service invocation',
    async (_label, name, args) => {
      const result = await client.callTool({ name, arguments: args });

      expect(result.isError).toBe(true);
      expect(inventoryService.updateStock).not.toHaveBeenCalled();
      expect(inventoryService.recordPurchases).not.toHaveBeenCalled();
    },
  );

  it('returns stock state conflicts as safe MCP tool errors', async () => {
    inventoryService.updateStock.mockRejectedValue(
      new ConflictException({
        code: 'STOCK_STATE_CONFLICT',
        message: 'Stock must be tracked before decrementing',
      }),
    );

    const result = await client.callTool({
      name: 'update_inventory',
      arguments: {
        productId: item.productId,
        operation: 'decrement',
        quantity: 1,
      },
    });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'STOCK_STATE_CONFLICT: Stock must be tracked before decrementing',
        },
      ],
      isError: true,
    });
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'update_inventory',
      errorType: 'domain_error',
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

  it.each([
    [PredictionFeedbackOutcome.accepted, undefined, FeedbackStatus.accepted],
    [PredictionFeedbackOutcome.rejected, undefined, FeedbackStatus.rejected],
    [
      PredictionFeedbackOutcome.corrected,
      PredictedState.likely_available,
      FeedbackStatus.rejected,
    ],
  ])(
    'records %s prediction feedback with MCP provenance',
    async (outcome, correctedState, feedbackStatus) => {
      const predictionId = '00000000-0000-4000-8000-000000000007';
      const response = {
        predictionId,
        productId: item.productId,
        feedbackStatus,
        outcome,
        correctedState: correctedState ?? null,
        feedbackEventId: '00000000-0000-4000-8000-000000000008',
        predictionAccuracy: 0.75,
      };
      predictionFeedbackService.submitFeedback.mockResolvedValue(response);

      const result = await client.callTool({
        name: 'record_prediction_feedback',
        arguments: {
          predictionId,
          outcome,
          ...(correctedState && { correctedState }),
        },
      });

      expect(predictionFeedbackService.submitFeedback).toHaveBeenCalledWith(
        predictionId,
        {
          outcome,
          ...(correctedState && { correctedState }),
          source: 'mcp',
        },
      );
      expect(result.structuredContent).toEqual(response);
      expect(result.content).toEqual([
        { type: 'text', text: JSON.stringify(response) },
      ]);
    },
  );

  it.each([
    {},
    { predictionId: 'not-a-uuid', outcome: 'accepted' },
    { predictionId: item.id, outcome: 'unknown' },
    { predictionId: item.id, outcome: 'corrected' },
    {
      predictionId: item.id,
      outcome: 'accepted',
      correctedState: PredictedState.probably_out,
    },
    {
      predictionId: item.id,
      outcome: 'corrected',
      correctedState: PredictedState.uncertain,
    },
    { predictionId: item.id, outcome: 'accepted', source: 'api' },
  ])(
    'rejects invalid prediction feedback before service invocation',
    async (args) => {
      const result = await client.callTool({
        name: 'record_prediction_feedback',
        arguments: args,
      });

      expect(result.isError).toBe(true);
      expect(predictionFeedbackService.submitFeedback).not.toHaveBeenCalled();
    },
  );

  it('returns prediction feedback domain conflicts as safe tool errors', async () => {
    predictionFeedbackService.submitFeedback.mockRejectedValue(
      new ConflictException('Prediction feedback was already recorded'),
    );

    const result = await client.callTool({
      name: 'record_prediction_feedback',
      arguments: { predictionId: item.id, outcome: 'accepted' },
    });

    expect(result).toEqual({
      content: [
        { type: 'text', text: 'Prediction feedback was already recorded' },
      ],
      isError: true,
    });
    expect(operationalLogger.mcpIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      tool: 'record_prediction_feedback',
      errorType: 'domain_error',
    });
  });

  it('sanitizes unexpected prediction feedback failures', async () => {
    predictionFeedbackService.submitFeedback.mockRejectedValue(
      new Error('database password leaked here'),
    );

    const result = await client.callTool({
      name: 'record_prediction_feedback',
      arguments: { predictionId: item.id, outcome: 'accepted' },
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
    expect(
      JSON.stringify(operationalLogger.mcpIntegration.mock.calls),
    ).not.toContain('database password leaked here');
  });

  it('completes selected grocery items with actual measurements and MCP provenance', async () => {
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
      {
        ...inventoryEvent(InventoryEventType.PURCHASED),
        unit: 'liters',
      },
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
      arguments: {
        items: [
          {
            groceryItemId: completedItem.id,
            actualQuantity: 2,
            actualUnit: 'liters',
          },
          { groceryItemId: secondItem.id },
        ],
      },
    });

    expect(inventoryService.completeGroceryPurchase).toHaveBeenCalledWith({
      items: [
        {
          groceryItemId: completedItem.id,
          actualQuantity: 2,
          actualUnit: 'liters',
        },
        { groceryItemId: secondItem.id },
      ],
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

  it('keeps the legacy grocery item ID selection available', async () => {
    inventoryService.completeGroceryPurchase.mockResolvedValue({
      events: [],
      completedItems: [],
    });

    await client.callTool({
      name: 'complete_grocery_purchase',
      arguments: { groceryItemIds: [item.id] },
    });

    expect(inventoryService.completeGroceryPurchase).toHaveBeenCalledWith({
      groceryItemIds: [item.id],
      source: 'mcp',
    });
  });

  it.each([
    {},
    { groceryItemIds: [] },
    { groceryItemIds: ['not-a-uuid'] },
    { groceryItemIds: [item.id, item.id] },
    { groceryItemIds: [item.id], productId: item.productId },
    { items: [] },
    { items: [{ groceryItemId: 'not-a-uuid' }] },
    {
      items: [{ groceryItemId: item.id }, { groceryItemId: item.id }],
    },
    { items: [{ groceryItemId: item.id, actualQuantity: 0 }] },
    { items: [{ groceryItemId: item.id, actualUnit: 'cartons' }] },
    {
      items: [
        {
          groceryItemId: item.id,
          actualQuantity: 2,
          actualUnit: '   ',
        },
      ],
    },
    { items: [{ groceryItemId: item.id, unexpected: true }] },
    {
      groceryItemIds: [item.id],
      items: [{ groceryItemId: item.id }],
    },
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

function stockMutationReceipt(
  eventType: InventoryEventType,
  overrides: { productId?: string; eventId?: string } = {},
) {
  const productId = overrides.productId ?? item.productId;
  const event = {
    ...inventoryEvent(eventType),
    id: overrides.eventId ?? '00000000-0000-4000-8000-000000000003',
    productId,
  };
  return {
    event,
    stock: {
      productId,
      unit: 'liter',
      recordedQuantity: 2,
      recordedAt: new Date('2026-08-27T12:00:00.000Z'),
      recordedSource: 'mcp',
      recordedEventId: event.id,
      estimatedQuantity: 2,
      estimatedState: PredictedState.likely_available,
      confidence: 1,
      reason: 'purchase_recorded',
      predictionId: null,
      evaluatedAt: new Date('2026-08-27T12:00:00.000Z'),
    },
  };
}
