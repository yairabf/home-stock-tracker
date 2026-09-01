import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';

describe('Product search MCP API (e2e)', () => {
  let app: INestApplication<App>;
  let client: Client;
  let prisma: PrismaService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `mcp-search-${randomUUID()}`;
  const productIds: string[] = [];
  const originalMcpEnabled = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    provider = {
      name: 'test',
      generateStructured: jest
        .fn()
        .mockRejectedValue(
          new Error('MCP product search must not invoke the LLM provider'),
        ),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER)
      .useValue(provider)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    client = new Client({ name: 'product-search-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
    provider.generateStructured.mockClear();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    if (originalMcpEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalMcpEnabled;
    }
  });

  it('discovers search_products after get_product with a bounded schema', async () => {
    const result = await client.listTools();
    const names = result.tools.map(({ name }) => name);
    const searchIndex = names.indexOf('search_products');

    expect(searchIndex).toBeGreaterThan(0);
    expect(names[searchIndex - 1]).toBe('get_product');
    expect(result.tools[searchIndex]).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['query'],
        properties: {
          limit: { type: 'integer', maximum: 20 },
        },
      },
    });
  });

  it.each([
    ['canonical', (canonicalName: string) => canonicalName],
    ['alias', (_canonicalName: string, alias: string) => alias],
  ])('returns an exact %s match', async (_label, queryFor) => {
    const canonicalName = `${prefix} Exact Milk`;
    const alias = `${prefix} Exact Alias`;
    const product = await createProduct({
      canonicalName,
      aliases: [alias],
      predictionEnabled: false,
    });

    const result = await callSearch(queryFor(canonicalName, alias));

    const content = result.structuredContent as {
      exactMatch: Record<string, unknown> | null;
      candidates: unknown[];
    };
    expect(content.exactMatch).toMatchObject({
      id: product.id,
      canonicalName,
      aliases: [alias],
      predictionEnabled: false,
    });
    expect(content.candidates).toEqual([]);
  });

  it('matches REST candidate order and fields, including unknown results', async () => {
    const query = `${prefix} candidate`;
    await createProduct({ canonicalName: `${query} A` });
    await createProduct({ canonicalName: `${query} Longer` });

    const mcpResult = await callSearch(query);
    const restResponse = await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ query })
      .set('Authorization', AUTHORIZATION)
      .expect(200);

    expect(mcpResult.structuredContent).toEqual(restResponse.body);
    expect(
      (mcpResult.structuredContent as { candidates: unknown[] }).candidates,
    ).toHaveLength(2);
    await expect(callSearch(`${prefix} unknown`)).resolves.toMatchObject({
      structuredContent: { exactMatch: null, candidates: [] },
    });
  });

  it('uses the default limit, permits 20, and rejects a higher limit', async () => {
    const query = `${prefix} bounded`;
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        createProduct({
          canonicalName: `${query} ${index.toString().padStart(2, '0')}`,
        }),
      ),
    );

    const defaultResult = await callSearch(query);
    const maximumResult = await callSearch(query, 20);
    const invalidResult = await client.callTool({
      name: 'search_products',
      arguments: { query, limit: 21 },
    });

    expect(
      (defaultResult.structuredContent as { candidates: unknown[] }).candidates,
    ).toHaveLength(10);
    expect(
      (maximumResult.structuredContent as { candidates: unknown[] }).candidates,
    ).toHaveLength(20);
    expect(invalidResult.isError).toBe(true);
  });

  it('does not invoke a provider or mutate domain state', async () => {
    const product = await createProduct({
      canonicalName: `${prefix} Readonly Milk`,
      predictionEnabled: false,
    });
    const before = await domainCounts();

    const result = await callSearch(`${prefix} readonly`);

    expect(result.structuredContent).toEqual({
      exactMatch: null,
      candidates: [
        expect.objectContaining({ id: product.id, predictionEnabled: false }),
      ],
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
    await expect(domainCounts()).resolves.toEqual(before);
  });

  async function callSearch(query: string, limit?: number) {
    return client.callTool({
      name: 'search_products',
      arguments: limit === undefined ? { query } : { query, limit },
    });
  }

  async function createProduct(
    input: Parameters<typeof createProductFixture>[1],
  ) {
    const product = await createProductFixture(prisma, input);
    productIds.push(product.id);
    return product;
  }

  async function domainCounts() {
    const [products, names, groceries, events, predictions, households] =
      await Promise.all([
        prisma.product.count(),
        prisma.productName.count(),
        prisma.groceryListItem.count(),
        prisma.inventoryEvent.count(),
        prisma.prediction.count(),
        prisma.household.count(),
      ]);
    return { products, names, groceries, events, predictions, households };
  }
});
