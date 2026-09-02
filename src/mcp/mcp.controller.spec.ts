import {
  Controller,
  Get,
  INestApplication,
  RequestMethod,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GroceryService } from '../grocery/grocery.service';
import { McpController } from './mcp.controller';
import {
  McpServerFactory,
  PUBLISHED_INVENTORY_EVENT_TYPES,
} from './mcp-server.factory';
import { ProductService } from '../product/product.service';
import { ProductSearchService } from '../product/product-search.service';
import { PREDICTION_ENGINE } from '../estimation/prediction-engine';
import { InventoryService } from '../inventory/inventory.service';
import { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';
import { APP_GUARD } from '@nestjs/core';
import { ServiceAuthModule } from '../auth/service-auth.module';
import { ServiceAuthGuard } from '../auth/service-auth.guard';
import { OperationalLogger } from '../observability/operational-logger.service';
import { ProductNameKind } from '../generated/prisma/enums';
import { PredictionFeedbackService } from '../inventory/prediction-feedback.service';
import { MCP_SERVER_INFO } from './agent-release-contract.generated';
import { HouseholdService } from '../household/household.service';

@Controller()
class TestRestController {
  @Get('ping')
  ping(): { status: string } {
    return { status: 'ok' };
  }
}

describe('McpController', () => {
  let app: INestApplication;
  let baseUrl: URL;
  let serverFactory: McpServerFactory;
  const originalEnabled = process.env.MCP_ENABLED;
  const originalAuthToken = process.env.API_AUTH_TOKEN;
  const authToken = 'mcp-service-token';
  const groceryService = {
    addItem: jest.fn(),
    confirmNewProduct: jest.fn(),
    confirmProductAlias: jest.fn(),
    removeItem: jest.fn(),
    listItems: jest.fn(),
  };
  const recommendationService = { getRecommendations: jest.fn() };
  const productService = { addAlias: jest.fn(), findOne: jest.fn() };
  const productSearchService = { search: jest.fn() };
  const inventoryService = {
    recordPurchase: jest.fn(),
    recordEvent: jest.fn(),
    listEvents: jest.fn(),
    completeGroceryPurchase: jest.fn(),
  };
  const predictionFeedbackService = { submitFeedback: jest.fn() };
  const householdService = { getContext: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.API_AUTH_TOKEN = authToken;
    const moduleRef = await Test.createTestingModule({
      imports: [ServiceAuthModule],
      controllers: [TestRestController, McpController],
      providers: [
        McpServerFactory,
        {
          provide: APP_GUARD,
          useExisting: ServiceAuthGuard,
        },
        {
          provide: GroceryService,
          useValue: groceryService,
        },
        { provide: ProductService, useValue: productService },
        { provide: ProductSearchService, useValue: productSearchService },
        {
          provide: PREDICTION_ENGINE,
          useValue: { predictProduct: jest.fn() },
        },
        {
          provide: InventoryService,
          useValue: inventoryService,
        },
        {
          provide: PredictionFeedbackService,
          useValue: predictionFeedbackService,
        },
        {
          provide: LowStockRecommendationService,
          useValue: recommendationService,
        },
        {
          provide: HouseholdService,
          useValue: householdService,
        },
        {
          provide: OperationalLogger,
          useValue: { mcpIntegration: jest.fn() },
        },
      ],
    }).compile();

    serverFactory = moduleRef.get(McpServerFactory);
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    await app.listen(0, '127.0.0.1');
    baseUrl = new URL(await app.getUrl());
  });

  afterEach(async () => {
    if (originalEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalEnabled;
    }
    if (originalAuthToken === undefined) {
      delete process.env.API_AUTH_TOKEN;
    } else {
      process.env.API_AUTH_TOKEN = originalAuthToken;
    }
    await app.close();
  });

  it('initializes an enabled stateless MCP server with grocery tools', async () => {
    process.env.MCP_ENABLED = 'true';
    const client = new Client({ name: 'mcp-test-client', version: '1.0.0' });
    const transport = createAuthenticatedTransport(baseUrl, authToken);

    try {
      await client.connect(transport);
      expect(client.getServerVersion()).toMatchObject(MCP_SERVER_INFO);
      const tools = await client.listTools();
      expect(tools.tools.map(({ name }) => name)).toEqual([
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
        'record_stock_signal',
        'record_prediction_feedback',
        'complete_grocery_purchase',
        'get_low_stock_predictions',
      ]);
      expect(
        tools.tools.find(({ name }) => name === 'get_product')?.inputSchema,
      ).toMatchObject({
        additionalProperties: false,
        properties: {
          id: { type: 'string', format: 'uuid' },
          productName: { type: 'string', minLength: 1 },
        },
        type: 'object',
      });
      const householdContext = {
        id: '00000000-0000-4000-8000-000000000010',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: ['child', 'teen'],
        predictionPreferences: null,
        suggestionConfidenceThreshold: 0.7,
        productPolicies: null,
      };
      householdService.getContext.mockResolvedValue(householdContext);
      await expect(
        client.callTool({ name: 'get_household_context', arguments: {} }),
      ).resolves.toMatchObject({ structuredContent: householdContext });
      expect(
        tools.tools.find(({ name }) => name === 'search_products')?.inputSchema,
      ).toMatchObject({
        additionalProperties: false,
        required: ['query'],
        properties: {
          limit: { type: 'integer', maximum: 20 },
        },
      });
      const eventHistoryTool = tools.tools.find(
        ({ name }) => name === 'list_inventory_events',
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
      expect(JSON.stringify(eventHistoryTool?.outputSchema)).not.toContain(
        'metadata',
      );
      expect(
        tools.tools.find(({ name }) => name === 'complete_grocery_purchase')
          ?.inputSchema,
      ).toMatchObject({
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
      productSearchService.search.mockResolvedValue({
        exactMatch: null,
        candidates: [],
      });
      await expect(
        client.callTool({
          name: 'search_products',
          arguments: { query: 'milk' },
        }),
      ).resolves.toMatchObject({
        structuredContent: { exactMatch: null, candidates: [] },
      });
      groceryService.listItems.mockResolvedValue([]);
      await expect(
        client.callTool({ name: 'grocery_list', arguments: {} }),
      ).resolves.toMatchObject({ structuredContent: { items: [] } });

      inventoryService.listEvents.mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      });
      await expect(
        client.callTool({ name: 'list_inventory_events', arguments: {} }),
      ).resolves.toMatchObject({
        structuredContent: { items: [], total: 0, limit: 20, offset: 0 },
      });
      expect(inventoryService.listEvents).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
      });

      const groceryItemId = '00000000-0000-4000-8000-000000000001';
      inventoryService.completeGroceryPurchase.mockResolvedValue({
        events: [],
        completedItems: [],
      });
      await expect(
        client.callTool({
          name: 'complete_grocery_purchase',
          arguments: {
            items: [
              {
                groceryItemId,
                actualQuantity: 2,
                actualUnit: 'cartons',
              },
            ],
          },
        }),
      ).resolves.toMatchObject({
        structuredContent: { events: [], completedItems: [] },
      });
      expect(inventoryService.completeGroceryPurchase).toHaveBeenCalledWith({
        items: [
          {
            groceryItemId,
            actualQuantity: 2,
            actualUnit: 'cartons',
          },
        ],
        source: 'mcp',
      });
      const productId = '00000000-0000-4000-8000-000000000002';
      productService.addAlias.mockResolvedValue({
        id: productId,
        names: [
          {
            id: 'name-canonical',
            productId,
            displayName: 'Milk',
            normalizedName: 'milk',
            kind: ProductNameKind.canonical,
          },
          {
            id: 'name-alias',
            productId,
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
      await expect(
        client.callTool({
          name: 'product_add_alias',
          arguments: { productId, alias: 'Whole Milk' },
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          id: productId,
          canonicalName: 'Milk',
          aliases: ['Whole Milk'],
        },
      });
      expect(productService.addAlias).toHaveBeenCalledWith(productId, {
        alias: 'Whole Milk',
      });
      await expect(
        client.callTool({
          name: 'complete_grocery_purchase',
          arguments: {
            groceryItemIds: [groceryItemId],
            items: [{ groceryItemId }],
          },
        }),
      ).resolves.toMatchObject({ isError: true });
      expect(inventoryService.completeGroceryPurchase).toHaveBeenCalledTimes(1);
      expect(transport.sessionId).toBeUndefined();
    } finally {
      await client.close();
    }
  });

  it('returns sanitized unexpected failures without crashing the protocol', async () => {
    process.env.MCP_ENABLED = 'true';
    recommendationService.getRecommendations.mockRejectedValue(
      new Error('database password leaked here'),
    );
    const client = new Client({ name: 'mcp-test-client', version: '1.0.0' });
    const transport = createAuthenticatedTransport(baseUrl, authToken);

    try {
      await client.connect(transport);
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
    } finally {
      await client.close();
    }
  });

  it('returns not found when MCP is disabled', async () => {
    process.env.MCP_ENABLED = 'false';

    const response = await fetch(new URL('/mcp', baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(initializeRequest),
    });

    expect(response.status).toBe(404);
  });

  it.each([
    ['a missing credential', undefined],
    ['an incorrect credential', 'Bearer wrong-token'],
  ])('rejects MCP initialization with %s', async (_case, authorization) => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (authorization) {
      headers.authorization = authorization;
    }
    const createSpy = jest.spyOn(serverFactory, 'create');

    const response = await fetch(new URL('/mcp', baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(initializeRequest),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: 'Unauthorized',
      statusCode: 401,
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('keeps REST routes under the API prefix', async () => {
    const prefixed = await fetch(new URL('/api/v1/ping', baseUrl), {
      headers: { authorization: `Bearer ${authToken}` },
    });
    const unprefixed = await fetch(new URL('/ping', baseUrl));

    expect(prefixed.status).toBe(200);
    await expect(prefixed.json()).resolves.toEqual({ status: 'ok' });
    expect(unprefixed.status).toBe(404);
  });
});

const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'mcp-test-client', version: '1.0.0' },
  },
};

function createAuthenticatedTransport(
  baseUrl: URL,
  authToken: string,
): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), {
    requestInit: {
      headers: { authorization: `Bearer ${authToken}` },
    },
  });
}
