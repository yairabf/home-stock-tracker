import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { TEST_APP_MODULE } from './app-module-fixture';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductService } from '../src/product/product.service';
import { ProductEnrichmentService } from '../src/product/product-enrichment.service';
import {
  PRODUCT_UNDERSTANDING,
  initialUnderstanding,
  UNDERSTANDING_FIELDS,
  type ProductUnderstandingInput,
  type ProductUnderstandingResult,
} from '../src/product/product-understanding';
import { createProductFixture } from './product-fixture';
import { getCanonicalProductName } from '../src/product/types/product-with-names';

function accepted(
  input: ProductUnderstandingInput,
): ProductUnderstandingResult {
  const result = initialUnderstanding(input.metadata);
  const values = {
    category: 'dairy',
    productType: 'fast_consumable',
    typicalUnit: 'liter',
    isPerishable: true,
  };
  const operationId = randomUUID();
  for (const field of UNDERSTANDING_FIELDS)
    if (input.metadata[field] === null) {
      Object.assign(result.fields, {
        [field]: {
          status: 'resolved',
          source: 'jev',
          value: values[field],
          confidence: 0.95,
        },
      });
      result.attempts.push({
        operationId,
        fields: [field],
        task: 'product_understanding',
        taskVersion: 'understanding-e2e-v1',
        provider: 'typesafe',
        configuredModel: 'jev-1.13.0',
        resolvedModel: 'jev-1.13.0',
        status: 'accepted',
        routingReason: 'supported_choice',
        elapsedMs: 1,
        usage: { input_tokens: 10, output_tokens: 1 },
      });
    }
  return result;
}

describe('product understanding persistence (isolated PostgreSQL)', () => {
  const prefix = `understanding ${randomUUID()}`;
  let app: INestApplication;
  let prisma: PrismaService;
  let products: ProductService;
  let enrichment: ProductEnrichmentService;
  const understand = jest.fn<
    Promise<ProductUnderstandingResult>,
    [ProductUnderstandingInput]
  >();
  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')
    )
      throw new Error('Requires an isolated database ending in _test');
    const module = await Test.createTestingModule({
      imports: [TEST_APP_MODULE],
    })
      .overrideProvider(PRODUCT_UNDERSTANDING)
      .useValue({ understand })
      .compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    products = app.get(ProductService);
    enrichment = app.get(ProductEnrichmentService);
  });
  beforeEach(() => {
    understand.mockReset();
    understand.mockImplementation((input) => Promise.resolve(accepted(input)));
  });
  afterAll(async () => {
    await prisma.product.deleteMany({
      where: {
        names: {
          some: { displayName: { startsWith: prefix, mode: 'insensitive' } },
        },
      },
    });
    await prisma.llmInferenceLog.deleteMany({
      where: { promptVersion: 'understanding-e2e-v1' },
    });
    await app.close();
  });
  it('fills nullable metadata and records accepted versus applied provenance without touching names', async () => {
    const product = await products.create({
      canonicalName: `${prefix} Milk`,
      aliases: [`${prefix} explicit alias`],
    });
    expect(product.isPerishable).toBeNull();
    const saved = await enrichment.enrich(product.id);
    expect(saved).toMatchObject({
      category: 'dairy',
      typicalUnit: 'liter',
      productType: 'fast_consumable',
      isPerishable: true,
    });
    expect(saved.names).toEqual(product.names);
    const logs = await prisma.llmInferenceLog.findMany({
      where: { promptVersion: 'understanding-e2e-v1' },
    });
    expect(
      logs.some(
        (log) =>
          (log.structuredResponse as { writeOutcome: string }).writeOutcome ===
          'applied',
      ),
    ).toBe(true);
    understand.mockClear();
    await enrichment.enrich(product.id);
    await products.findOrCreateByExactOrAliasMatch(
      getCanonicalProductName(product),
    );
    await products.findOrCreateByExactOrAliasMatch(`${prefix} explicit alias`);
    await products.findAll();
    expect(understand).not.toHaveBeenCalled();
  });
  it('leaves partial unknowns null and preserves supplied false and legacy category', async () => {
    const product = await createProductFixture(prisma, {
      canonicalName: `${prefix} Partial`,
      category: 'legacy',
      isPerishable: false,
    });
    understand.mockImplementation((input) => {
      const result = initialUnderstanding(input.metadata);
      result.fields.typicalUnit = {
        status: 'resolved',
        source: 'jev',
        value: 'pack',
        confidence: 0.95,
      };
      result.fields.productType = { status: 'uncertain', reason: 'unknown' };
      return Promise.resolve(result);
    });
    expect(await enrichment.enrich(product.id)).toMatchObject({
      category: 'legacy',
      isPerishable: false,
      typicalUnit: 'pack',
      productType: null,
    });
  });
  it.each(['metadata', 'identity'])(
    'discards inference after concurrent explicit %s change',
    async (change) => {
      const product = await products.create({
        canonicalName: `${prefix} Race ${change}`,
      });
      let start!: () => void;
      const started = new Promise<void>((resolve) => {
        start = resolve;
      });
      let release!: (value: ProductUnderstandingResult) => void;
      const pending = new Promise<ProductUnderstandingResult>((resolve) => {
        release = resolve;
      });
      let captured!: ProductUnderstandingInput;
      understand.mockImplementation((input) => {
        captured = input;
        start();
        return pending;
      });
      const operation = enrichment.enrich(product.id);
      await started;
      if (change === 'metadata')
        await prisma.product.update({
          where: { id: product.id },
          data: { category: 'explicit correction' },
        });
      else
        await products.addAlias(product.id, {
          alias: `${prefix} concurrent alias`,
        });
      release(accepted(captured));
      const saved = await operation;
      expect(saved.typicalUnit).toBeNull();
      expect(saved.isPerishable).toBeNull();
      expect(saved.category).toBe(
        change === 'metadata' ? 'explicit correction' : null,
      );
      const stale = await prisma.llmInferenceLog.findMany({
        where: {
          promptVersion: 'understanding-e2e-v1',
          structuredResponse: { path: ['writeOutcome'], equals: 'stale' },
        },
      });
      expect(stale.length).toBeGreaterThan(0);
    },
  );
  it('returns not found if the product disappears while inference is pending', async () => {
    const product = await products.create({
      canonicalName: `${prefix} Deleted`,
    });
    understand.mockImplementation(async (input) => {
      await prisma.product.delete({ where: { id: product.id } });
      return accepted(input);
    });
    await expect(enrichment.enrich(product.id)).rejects.toThrow(
      `No product with id "${product.id}"`,
    );
  });
  it('preserves entered names and one namespace owner under concurrent assisted creation', async () => {
    const name = `${prefix} New Milk`;
    const saved = await Promise.all([
      products.findOrCreateByExactOrAliasMatch(name),
      products.findOrCreateByExactOrAliasMatch(` ${name.toUpperCase()} `),
    ]);
    expect(saved[0].id).toBe(saved[1].id);
    expect(saved[0].names).toHaveLength(1);
    expect(saved[0].names[0].normalizedName).toBe(name.toLowerCase());
    expect(saved[0].names[0].displayName).toBe(saved[1].names[0].displayName);
  });
  it('does not block a product write on diagnostic persistence failure', async () => {
    const spy = jest
      .spyOn(prisma.llmInferenceLog, 'create')
      .mockRejectedValue(new Error('private diagnostic error'));
    try {
      const product = await products.create({
        canonicalName: `${prefix} Log Failure`,
      });
      expect((await enrichment.enrich(product.id)).isPerishable).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
