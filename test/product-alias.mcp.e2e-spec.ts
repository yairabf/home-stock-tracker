import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { normalizeProductName } from '../src/product/product-name.util';
import { ProductService } from '../src/product/product.service';

const AUTHORIZATION = 'Bearer e2e-service-token';

describe('Standalone product alias MCP contract (e2e)', () => {
  let app: INestApplication;
  let client: Client;
  let prisma: PrismaService;
  let productService: ProductService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `mcp-product-alias-${randomUUID()}`;
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
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    productService = app.get(ProductService);
    client = new Client({ name: 'product-alias-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterEach(async () => {
    const productIds = await findTestProductIds();
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

  it('publishes a strict standalone alias tool', async () => {
    const tools = await client.listTools();
    const tool = tools.tools.find(({ name }) => name === 'product_add_alias');

    expect(tool?.description).toContain('explicit confirmation');
    expect(tool).toMatchObject({
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
          canonicalName: { type: 'string' },
          aliases: { type: 'array' },
        },
      },
    });
  });

  it('persists an alias and converges on same-owner retries', async () => {
    const canonicalName = `${prefix} Milk`;
    const alias = `${prefix} Whole Milk`;
    const product = await createProduct(canonicalName);

    const created = await addAlias(product.id, alias);
    const retried = await addAlias(product.id, `  ${alias.toUpperCase()}  `);
    const canonicalRetry = await addAlias(product.id, canonicalName);

    expect(created.isError).not.toBe(true);
    expect(created.structuredContent).toMatchObject({
      id: product.id,
      canonicalName,
      aliases: [alias],
    });
    expect(retried.structuredContent).toMatchObject({ aliases: [alias] });
    expect(canonicalRetry.structuredContent).toMatchObject({
      aliases: [alias],
    });
    await expect(
      prisma.productName.count({
        where: { normalizedName: normalizeProductName(alias) },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.groceryListItem.count({ where: { productId: product.id } }),
    ).resolves.toBe(0);
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('rejects an alias owned by another product', async () => {
    const alias = `${prefix} Shared Alias`;
    const owner = await createProduct(`${prefix} Owner`);
    const target = await createProduct(`${prefix} Target`);
    await addAlias(owner.id, alias);

    const result = await addAlias(target.id, alias);

    expect(result.isError).toBe(true);
    expect(toolText(result)).toContain('PRODUCT_NAME_CONFLICT');
    await expect(
      prisma.productName.count({
        where: {
          productId: target.id,
          normalizedName: normalizeProductName(alias),
        },
      }),
    ).resolves.toBe(0);
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('returns a safe final error for a deleted target', async () => {
    const product = await createProduct(`${prefix} Deleted`);
    await prisma.product.delete({ where: { id: product.id } });

    const result = await addAlias(product.id, `${prefix} Missing Alias`);

    expect(result.isError).toBe(true);
    expect(toolText(result)).toBe(`No product with id "${product.id}"`);
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it.each([
    ['malformed product ID', { productId: 'not-a-uuid', alias: 'Whole Milk' }],
    ['blank alias', { productId: randomUUID(), alias: '   ' }],
    [
      'unknown input',
      { productId: randomUUID(), alias: 'Whole Milk', source: 'api' },
    ],
  ])('rejects %s without mutation', async (_case, arguments_) => {
    const before = await prisma.productName.count();

    const result = await client.callTool({
      name: 'product_add_alias',
      arguments: arguments_,
    });

    expect(result.isError).toBe(true);
    await expect(prisma.productName.count()).resolves.toBe(before);
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  function createProduct(canonicalName: string) {
    return productService.create({
      canonicalName,
      aliases: [],
      category: 'test',
      typicalUnit: 'unit',
    });
  }

  function addAlias(productId: string, alias: string) {
    return client.callTool({
      name: 'product_add_alias',
      arguments: { productId, alias },
    });
  }

  async function findTestProductIds(): Promise<string[]> {
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
    return products.map(({ id }) => id);
  }

  function toolText(result: { content: unknown }): string {
    if (!Array.isArray(result.content)) {
      return '';
    }
    return (result.content as Array<{ type?: string; text?: string }>)
      .filter(
        (entry): entry is { type: string; text: string } =>
          entry.type === 'text' && typeof entry.text === 'string',
      )
      .map(({ text }) => text)
      .join('\n');
  }
});
