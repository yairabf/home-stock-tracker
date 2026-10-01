import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../src/app.module';
import { TEST_MODEL_CONFIG } from './app-module-fixture';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const CONFIG = {
  ...TEST_MODEL_CONFIG,
  productResolutionProvider: 'typesafe' as const,
  typesafeApiKey: 'private-fixture-key',
  jevModel: 'jev-1.13.0',
};
const AUTHORIZATION = 'Bearer e2e-service-token';

describe('Jev matching confirmation safety (PostgreSQL, REST and MCP)', () => {
  let app: INestApplication<App>;
  let client: Client;
  let prisma: PrismaService;
  let fetcher: jest.MockedFunction<typeof fetch>;
  let provider: jest.Mocked<LlmProvider>;
  let prefix: string;
  let productId: string;
  let phrase: string;
  let startingLogs: Set<string>;
  const priorMcp = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    fetcher = jest.fn();
    provider = { name: 'fake', generateStructured: jest.fn() };
    const module = await Test.createTestingModule({
      imports: [AppModule.register(CONFIG)],
    })
      .overrideProvider(JevDecisionClient)
      .useValue(new JevDecisionClient(CONFIG, fetcher))
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
    client = new Client({ name: 'jev-matching-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  beforeEach(async () => {
    prefix = `jev-${randomUUID()}`;
    phrase = `${prefix} milk`;
    productId = (
      await createProductFixture(prisma, { canonicalName: `${phrase} whole` })
    ).id;
    startingLogs = new Set(
      (await prisma.llmInferenceLog.findMany({ select: { id: true } })).map(
        ({ id }) => id,
      ),
    );
    fetcher.mockReset();
    provider.generateStructured.mockReset();
    fetcher.mockImplementation((_url, init) => {
      if (typeof init?.body !== 'string')
        throw new Error('Expected JSON request');
      const body = JSON.parse(init.body) as {
        questions: { product_match: { criteria: Record<string, unknown> } };
      };
      const options = Object.keys(body.questions.product_match.criteria);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'jev-1.14.0',
            answers: {
              product_match: {
                type: 'choice',
                choice: 'candidate_0',
                confidence: 0.95,
                probabilities: Object.fromEntries(
                  options.map((token) => [
                    token,
                    token === 'candidate_0' ? 1 : 0,
                  ]),
                ),
              },
            },
            usage: { input_tokens: 20, output_tokens: 3 },
          }),
          { status: 200 },
        ),
      );
    });
  });

  afterEach(async () => {
    const logs = await prisma.llmInferenceLog.findMany({
      select: { id: true },
    });
    await prisma.llmInferenceLog.deleteMany({
      where: {
        id: {
          in: logs.map(({ id }) => id).filter((id) => !startingLogs.has(id)),
        },
      },
    });
    const products = await prisma.product.findMany({
      where: { names: { some: { displayName: { startsWith: prefix } } } },
      select: { id: true },
    });
    const ids = products.map(({ id }) => id);
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: ids } },
    });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  });

  afterAll(async () => {
    await client?.close();
    await app?.close();
    if (priorMcp === undefined) delete process.env.MCP_ENABLED;
    else process.env.MCP_ENABLED = priorMcp;
  });

  it.each(['rest', 'mcp'])(
    '%s advice preserves domain state until explicit alias confirmation',
    async (transport) => {
      const before = await domainCounts();
      const groceryItem = {
        requestedQuantity: 2,
        unit: 'liter',
        note: 'original request',
      };
      const result = await add(transport, {
        unknownProductPolicy: 'propose_if_missing',
        productName: phrase,
        groceryItem,
      });
      expect(result).toMatchObject({
        outcome: 'product_resolution_required',
        requestedAddition: { productName: phrase, ...groceryItem },
        candidates: [{ id: productId }],
        proposal: {
          recommendation: 'add_alias',
          targetProductId: productId,
          alias: phrase,
          confidence: 0.95,
        },
        allowedActions: [
          'use_existing_product',
          'add_alias',
          'create_product',
          'cancel',
        ],
      });
      expect(Object.keys(result).sort()).toEqual(
        [
          'outcome',
          'requestedAddition',
          'candidates',
          'proposal',
          'allowedActions',
        ].sort(),
      );
      await expect(domainCounts()).resolves.toEqual(before);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const logs = await prisma.llmInferenceLog.findMany({
        where: { id: { notIn: [...startingLogs] } },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        modelProvider: 'typesafe',
        modelVersion: 'jev-1.14.0',
        promptVersion: 'jev-product-resolution-v1',
        confidence: 0.95,
        structuredResponse: { status: 'validated', proposal: result.proposal },
      });
      expect(JSON.stringify(logs[0])).not.toMatch(
        /private-fixture-key|requestedPhrase|probabilities|input_tokens/,
      );

      const confirmed = await confirmAlias(transport, {
        targetProductId: productId,
        alias: phrase,
        groceryItem,
      });
      expect(confirmed).toMatchObject({
        outcome: 'created',
        createdItem: {
          productId,
          requestedQuantity: 2,
          unit: 'liter',
          note: 'original request',
        },
      });
      expect(
        await prisma.productName.count({
          where: { productId, normalizedName: phrase },
        }),
      ).toBe(1);
      expect(await prisma.groceryListItem.count({ where: { productId } })).toBe(
        1,
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(provider.generateStructured.mock.calls).toHaveLength(0);
    },
  );

  it.each(['rest', 'mcp'])(
    '%s abstention keeps clarification and explicit creation available',
    async (transport) => {
      fetcher.mockResolvedValue(new Response('{}', { status: 200 }));
      const before = await domainCounts();
      const result = await add(transport, {
        unknownProductPolicy: 'propose_if_missing',
        productName: phrase,
        groceryItem: { requestedQuantity: 3 },
      });
      expect(result).toMatchObject({
        proposal: null,
        candidates: [{ id: productId }],
        requestedAddition: { requestedQuantity: 3 },
        allowedActions: [
          'use_existing_product',
          'add_alias',
          'create_product',
          'cancel',
        ],
      });
      await expect(domainCounts()).resolves.toEqual(before);
      const missing = `${prefix} unmatched`;
      const noCandidates = await add(transport, {
        unknownProductPolicy: 'propose_if_missing',
        productName: missing,
        groceryItem: { requestedQuantity: 3 },
      });
      expect(noCandidates).toMatchObject({
        proposal: null,
        candidates: [],
        allowedActions: ['create_product', 'cancel'],
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      const newProduct = {
        canonicalName: missing,
        aliases: [],
        category: 'other',
        typicalUnit: 'unit',
        productType: 'discrete_consumable',
        isPerishable: false,
      };
      const payload = {
        product: newProduct,
        groceryItem: { requestedQuantity: 3 },
      };
      const created =
        transport === 'rest'
          ? ((await post('/api/v1/grocery/items/confirm-new-product', payload))
              .body as Record<string, unknown>)
          : await tool('grocery_confirm_new_product', payload);
      expect(created).toMatchObject({
        outcome: 'created',
        createdItem: { productName: missing, requestedQuantity: 3 },
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(provider.generateStructured.mock.calls).toHaveLength(0);
    },
  );

  async function post(path: string, body: unknown) {
    return request(app.getHttpServer())
      .post(path)
      .set('Authorization', AUTHORIZATION)
      .send(body)
      .expect(201);
  }
  async function tool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    return result.structuredContent as Record<string, unknown>;
  }
  async function add(transport: string, body: Record<string, unknown>) {
    return transport === 'rest'
      ? ((await post('/api/v1/grocery/items', body)).body as Record<
          string,
          unknown
        >)
      : tool('grocery_add', body);
  }
  async function confirmAlias(
    transport: string,
    body: Record<string, unknown>,
  ) {
    return transport === 'rest'
      ? ((await post('/api/v1/grocery/items/confirm-product-alias', body))
          .body as Record<string, unknown>)
      : tool('grocery_confirm_product_alias', body);
  }
  async function domainCounts() {
    const [products, names, groceries, events, projections, predictions] =
      await Promise.all([
        prisma.product.count(),
        prisma.productName.count(),
        prisma.groceryListItem.count(),
        prisma.inventoryEvent.count(),
        prisma.stockProjection.count(),
        prisma.prediction.count(),
      ]);
    return { products, names, groceries, events, projections, predictions };
  }
});
