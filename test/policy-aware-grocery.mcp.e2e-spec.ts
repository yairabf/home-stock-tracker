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
import { AppModule } from '../src/app.module';
import { ProductType } from '../src/generated/prisma/enums';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { normalizeProductName } from '../src/product/product-name.util';

const AUTHORIZATION = 'Bearer e2e-service-token';

describe('Policy-aware grocery MCP contract (e2e)', () => {
  let app: INestApplication;
  let client: Client;
  let prisma: PrismaService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `mcp-policy-${randomUUID()}`;
  const originalMcpEnabled = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    provider = { name: 'fake', generateStructured: jest.fn() };
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
    client = new Client({ name: 'policy-grocery-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterEach(async () => {
    const products = await prisma.product.findMany({
      where: {
        names: {
          some: {
            normalizedName: { startsWith: normalizeProductName(prefix) },
          },
        },
      },
      select: { id: true },
    });
    const productIds = products.map(({ id }) => id);
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    provider.generateStructured.mockReset();
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

  it('publishes policy fields, defaults, and all result outcomes', async () => {
    const tools = await client.listTools();
    const groceryAdd = tools.tools.find(({ name }) => name === 'grocery_add');

    expect(groceryAdd?.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ['groceryItem'],
      properties: {
        unknownProductPolicy: { default: 'propose_if_missing' },
        productName: { type: 'string' },
        product: { type: 'object' },
        groceryItem: { type: 'object' },
      },
    });
    expect(JSON.stringify(groceryAdd?.outputSchema)).toContain(
      'product_resolution_required',
    );
  });

  it('publishes focused strict confirmation tools', async () => {
    const tools = await client.listTools();
    const createTool = tools.tools.find(
      ({ name }) => name === 'grocery_confirm_new_product',
    );
    const aliasTool = tools.tools.find(
      ({ name }) => name === 'grocery_confirm_product_alias',
    );

    expect(createTool?.description).toContain('without an LLM call');
    expect(createTool).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['product', 'groceryItem'],
      },
    });
    expect(aliasTool?.description).toContain('exact target product ID');
    expect(aliasTool).toMatchObject({
      inputSchema: {
        additionalProperties: false,
        required: ['targetProductId', 'alias', 'groceryItem'],
      },
    });
    expect(JSON.stringify(createTool?.outputSchema)).not.toContain(
      'product_resolution_required',
    );
  });

  it('defaults an uncertain name to a successful proposal outcome', async () => {
    const productName = `${prefix} unresolved`;
    provider.generateStructured.mockResolvedValue({ status: 'unavailable' });
    const before = await domainCounts();

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: { productName, groceryItem: {} },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      outcome: 'product_resolution_required',
      requestedAddition: { productName },
      allowedActions: ['create_product', 'cancel'],
    });
    await expect(domainCounts()).resolves.toEqual(before);
  });

  it('supports explicit deterministic creation with MCP provenance', async () => {
    const canonicalName = `${prefix} deterministic`;

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: {
        unknownProductPolicy: 'create_if_missing',
        product: productInput(canonicalName),
        groceryItem: {},
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      outcome: 'created',
      createdItem: { productName: canonicalName, source: 'mcp' },
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('confirms a new product without LLM use and converges on retry', async () => {
    const canonicalName = `${prefix} confirmed`;

    const created = await confirmNewProduct(canonicalName, 2);
    const retry = await confirmNewProduct(canonicalName, 2);

    expect(created.isError).not.toBe(true);
    expect(created.structuredContent).toMatchObject({
      outcome: 'created',
      createdItem: { source: 'mcp', requestedQuantity: 2 },
    });
    expect(retry.structuredContent).toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ requestedQuantity: 2 }],
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('confirms an alias and keeps it when grocery quantity needs confirmation', async () => {
    const canonicalName = `${prefix} alias target`;
    const alias = `${prefix} approved alias`;
    const created = await confirmNewProduct(canonicalName, 3);
    const productId = createdProductId(created.structuredContent);

    const result = await client.callTool({
      name: 'grocery_confirm_product_alias',
      arguments: {
        targetProductId: productId,
        alias,
        groceryItem: { requestedQuantity: 2 },
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ productId, requestedQuantity: 3 }],
      requestedAddition: { productName: alias, requestedQuantity: 2 },
    });
    await expect(
      prisma.productName.count({
        where: { normalizedName: normalizeProductName(alias) },
      }),
    ).resolves.toBe(1);
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('preserves stable namespace conflict details', async () => {
    const sharedName = `${prefix} shared`;
    await confirmNewProduct(sharedName);

    const result = await client.callTool({
      name: 'grocery_confirm_new_product',
      arguments: {
        product: {
          ...productInput(`${prefix} conflicting`),
          aliases: [sharedName],
        },
        groceryItem: {},
      },
    });

    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain('PRODUCT_NAME_CONFLICT');
  });

  it.each([
    ['proposal state', { proposalId: 'proposal-1' }],
    ['caller source', { source: 'api' }],
    [
      'pending override',
      { groceryItem: { ifPendingExists: 'create_separate' } },
    ],
  ])('rejects confirmation %s before mutation', async (_label, extra) => {
    const before = await domainCounts();
    const result = await client.callTool({
      name: 'grocery_confirm_new_product',
      arguments: {
        product: productInput(`${prefix} invalid`),
        groceryItem: {},
        ...extra,
      },
    });

    expect(result.isError).toBe(true);
    await expect(domainCounts()).resolves.toEqual(before);
  });

  it('rejects mixed policy inputs before mutation', async () => {
    const canonicalName = `${prefix} invalid`;

    const result = await client.callTool({
      name: 'grocery_add',
      arguments: {
        unknownProductPolicy: 'create_if_missing',
        productName: canonicalName,
        product: productInput(canonicalName),
        groceryItem: {},
      },
    });

    expect(result.isError).toBe(true);
    await expect(domainCounts()).resolves.toEqual({
      products: 0,
      names: 0,
      groceries: 0,
    });
  });

  function productInput(canonicalName: string) {
    return {
      canonicalName,
      aliases: [],
      category: 'test',
      typicalUnit: null,
      productType: ProductType.fast_consumable,
      isPerishable: false,
    };
  }

  function confirmNewProduct(
    canonicalName: string,
    requestedQuantity?: number,
  ) {
    return client.callTool({
      name: 'grocery_confirm_new_product',
      arguments: {
        product: {
          ...productInput(canonicalName),
          aliases: [`${canonicalName} alias`],
        },
        groceryItem: { requestedQuantity },
      },
    });
  }

  function createdProductId(structuredContent: unknown): string {
    if (
      !structuredContent ||
      typeof structuredContent !== 'object' ||
      !('createdItem' in structuredContent)
    ) {
      throw new Error('Expected a created confirmation result');
    }
    const createdItem = structuredContent.createdItem;
    if (
      !createdItem ||
      typeof createdItem !== 'object' ||
      !('productId' in createdItem) ||
      typeof createdItem.productId !== 'string'
    ) {
      throw new Error('Expected a created confirmation item');
    }
    return createdItem.productId;
  }

  function toolText(result: { content: unknown }): string {
    if (!Array.isArray(result.content)) {
      return '';
    }
    const entries = result.content as unknown[];
    return entries
      .filter((entry): entry is { type: 'text'; text: string } =>
        Boolean(
          entry &&
          typeof entry === 'object' &&
          'type' in entry &&
          entry.type === 'text' &&
          'text' in entry &&
          typeof entry.text === 'string',
        ),
      )
      .map(({ text }) => text)
      .join('\n');
  }

  async function domainCounts() {
    const normalizedPrefix = normalizeProductName(prefix);
    const [products, names, groceries] = await Promise.all([
      prisma.product.count({
        where: {
          names: { some: { normalizedName: { startsWith: normalizedPrefix } } },
        },
      }),
      prisma.productName.count({
        where: { normalizedName: { startsWith: normalizedPrefix } },
      }),
      prisma.groceryListItem.count({
        where: {
          product: {
            names: {
              some: { normalizedName: { startsWith: normalizedPrefix } },
            },
          },
        },
      }),
    ]);
    return { products, names, groceries };
  }
});
