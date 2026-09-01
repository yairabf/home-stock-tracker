import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { ProductNameKind } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';

interface ProductResponseBody {
  id: string;
  canonicalName: string;
}

describe('Product name writes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testPrefix = `e2e namespace writes ${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const products = await prisma.productName.findMany({
      where: {
        kind: ProductNameKind.canonical,
        displayName: { startsWith: testPrefix },
      },
      select: { productId: true },
    });
    await prisma.product.deleteMany({
      where: { id: { in: products.map(({ productId }) => productId) } },
    });
    await app.close();
  });

  it('atomically creates canonical and alias rows', async () => {
    const canonicalName = `${testPrefix} Atomic Milk`;
    const alias = `${testPrefix} Whole Milk`;

    const response = await createProduct(canonicalName, [alias]).expect(201);
    const created = response.body as ProductResponseBody;
    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: created.id },
      include: { names: { orderBy: { kind: 'asc' } } },
    });

    expect(stored).toMatchObject({
      category: 'dairy',
      typicalUnit: 'carton',
    });
    expect(stored.names).toEqual([
      expect.objectContaining({
        displayName: canonicalName,
        normalizedName: canonicalName.toLowerCase(),
        kind: ProductNameKind.canonical,
      }),
      expect.objectContaining({
        displayName: alias,
        normalizedName: alias.toLowerCase(),
        kind: ProductNameKind.alias,
      }),
    ]);
  });

  it('rolls back the parent product when one proposed name is owned', async () => {
    const ownerName = `${testPrefix} Rollback Owner`;
    const conflictingAlias = `${testPrefix} Rollback Alias`;
    await createProduct(ownerName, [conflictingAlias]).expect(201);

    const attemptedCanonical = `${testPrefix} Rolled Back Product`;
    await createProduct(attemptedCanonical, [conflictingAlias])
      .expect(409)
      .expect({
        code: 'PRODUCT_NAME_CONFLICT',
        message: 'A product name is already assigned to another product',
      });

    await expect(
      prisma.productName.count({
        where: { normalizedName: attemptedCanonical.toLowerCase() },
      }),
    ).resolves.toBe(0);
  });

  it('treats same-owner aliases as idempotent and rejects cross-owner claims', async () => {
    const first = await createProduct(`${testPrefix} Alias First`, []).expect(
      201,
    );
    const second = await createProduct(`${testPrefix} Alias Second`, []).expect(
      201,
    );
    const alias = `${testPrefix} Shared Alias`;
    const firstProduct = first.body as ProductResponseBody;
    const secondProduct = second.body as ProductResponseBody;

    await addAlias(firstProduct.id, alias).expect(201);
    await addAlias(firstProduct.id, `  ${alias.toUpperCase()}  `).expect(201);
    await addAlias(firstProduct.id, firstProduct.canonicalName).expect(201);
    await addAlias(secondProduct.id, alias).expect(409).expect({
      code: 'PRODUCT_NAME_CONFLICT',
      message: 'A product name is already assigned to another product',
    });

    const [firstAliases, secondAliases] = await Promise.all([
      prisma.productName.findMany({
        where: { productId: firstProduct.id, kind: ProductNameKind.alias },
        select: { displayName: true },
      }),
      prisma.productName.findMany({
        where: { productId: secondProduct.id, kind: ProductNameKind.alias },
        select: { displayName: true },
      }),
    ]);
    expect(firstAliases).toEqual([{ displayName: alias }]);
    expect(secondAliases).toEqual([]);
    await expect(
      prisma.productName.count({
        where: { normalizedName: alias.toLowerCase() },
      }),
    ).resolves.toBe(1);
  });

  it('returns one stable conflict for concurrent product creation', async () => {
    const canonicalName = `${testPrefix} Concurrent Product`;

    const responses = await Promise.all([
      createProduct(canonicalName, []),
      createProduct(`  ${canonicalName.toUpperCase()}  `, []),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(responses.find(({ status }) => status === 409)?.body).toEqual({
      code: 'PRODUCT_NAME_CONFLICT',
      message: 'A product name is already assigned to another product',
    });
    await expect(
      prisma.productName.count({
        where: { normalizedName: canonicalName.toLowerCase() },
      }),
    ).resolves.toBe(1);
  });

  it('assigns a concurrently claimed alias to exactly one product', async () => {
    const first = await createProduct(
      `${testPrefix} Concurrent Alias First`,
      [],
    ).expect(201);
    const second = await createProduct(
      `${testPrefix} Concurrent Alias Second`,
      [],
    ).expect(201);
    const alias = `${testPrefix} Concurrent Shared Alias`;
    const firstProduct = first.body as ProductResponseBody;
    const secondProduct = second.body as ProductResponseBody;

    const responses = await Promise.all([
      addAlias(firstProduct.id, alias),
      addAlias(secondProduct.id, alias),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(responses.find(({ status }) => status === 409)?.body).toEqual({
      code: 'PRODUCT_NAME_CONFLICT',
      message: 'A product name is already assigned to another product',
    });
    await expect(
      prisma.productName.count({
        where: { normalizedName: alias.toLowerCase() },
      }),
    ).resolves.toBe(1);
  });

  function createProduct(canonicalName: string, aliases: string[]) {
    return request(app.getHttpServer()).post('/api/v1/products').send({
      canonicalName,
      aliases,
      category: 'dairy',
      typicalUnit: 'carton',
    });
  }

  function addAlias(productId: string, alias: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/aliases`)
      .send({ alias });
  }
});
