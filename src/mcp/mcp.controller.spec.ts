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
import { McpServerFactory } from './mcp-server.factory';
import { ProductService } from '../product/product.service';
import { PREDICTION_ENGINE } from '../estimation/prediction-engine';
import { InventoryService } from '../inventory/inventory.service';
import { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';

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
  const originalEnabled = process.env.MCP_ENABLED;
  const groceryService = {
    addItem: jest.fn(),
    removeItem: jest.fn(),
    listItems: jest.fn(),
  };
  const recommendationService = { getRecommendations: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestRestController, McpController],
      providers: [
        McpServerFactory,
        {
          provide: GroceryService,
          useValue: groceryService,
        },
        { provide: ProductService, useValue: { findOne: jest.fn() } },
        {
          provide: PREDICTION_ENGINE,
          useValue: { predictProduct: jest.fn() },
        },
        {
          provide: InventoryService,
          useValue: { recordPurchase: jest.fn(), recordEvent: jest.fn() },
        },
        {
          provide: LowStockRecommendationService,
          useValue: recommendationService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port');
    }
    baseUrl = new URL(`http://127.0.0.1:${address.port}`);
  });

  afterEach(async () => {
    if (originalEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalEnabled;
    }
    await app.close();
  });

  it('initializes an enabled stateless MCP server with grocery tools', async () => {
    process.env.MCP_ENABLED = 'true';
    const client = new Client({ name: 'mcp-test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL('/mcp', baseUrl),
    );

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map(({ name }) => name)).toEqual([
        'grocery_add',
        'grocery_remove',
        'grocery_list',
        'get_product',
        'get_inventory',
        'record_purchase',
        'record_stock_signal',
        'get_low_stock_predictions',
      ]);
      groceryService.listItems.mockResolvedValue([]);
      await expect(
        client.callTool({ name: 'grocery_list', arguments: {} }),
      ).resolves.toMatchObject({ structuredContent: { items: [] } });
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
    const transport = new StreamableHTTPClientTransport(
      new URL('/mcp', baseUrl),
    );

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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'mcp-test-client', version: '1.0.0' },
        },
      }),
    });

    expect(response.status).toBe(404);
  });

  it('keeps REST routes under the API prefix', async () => {
    const prefixed = await fetch(new URL('/api/v1/ping', baseUrl));
    const unprefixed = await fetch(new URL('/ping', baseUrl));

    expect(prefixed.status).toBe(200);
    await expect(prefixed.json()).resolves.toEqual({ status: 'ok' });
    expect(unprefixed.status).toBe(404);
  });
});
