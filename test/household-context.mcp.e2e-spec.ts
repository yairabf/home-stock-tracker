import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { HouseholdModel } from '../src/generated/prisma/models';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const AUTHORIZATION = 'Bearer e2e-service-token';

describe('Household context MCP contract (e2e)', () => {
  let app: INestApplication;
  let client: Client | undefined;
  let prisma: PrismaService;
  let household: HouseholdModel;
  let createdFixture = false;
  const originalMcpEnabled = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    const existing = await prisma.household.findFirst();
    household = existing ?? (await createFixtureHousehold());
    createdFixture = existing === null;
    client = new Client({ name: 'household-context-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterAll(async () => {
    if (createdFixture) {
      await prisma.household.deleteMany({ where: { id: household.id } });
    }
    await client?.close();
    await app.close();
    if (originalMcpEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalMcpEnabled;
    }
  });

  it('returns only the configured household context', async () => {
    const result = await client!.callTool({
      name: 'get_household_context',
      arguments: {},
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual({
      id: household.id,
      adultsCount: household.adultsCount,
      childrenCount: household.childrenCount,
      childAgeGroups: household.childAgeGroups,
      predictionPreferences: household.predictionPreferences,
      suggestionConfidenceThreshold: household.suggestionConfidenceThreshold,
      productPolicies: household.productPolicies,
    });
    expect(result.structuredContent).not.toHaveProperty('createdAt');
    expect(result.structuredContent).not.toHaveProperty('updatedAt');
  });

  it('fails without creating a household when setup is missing', async () => {
    await prisma.household.delete({ where: { id: household.id } });

    try {
      const result = await client!.callTool({
        name: 'get_household_context',
        arguments: {},
      });

      expect(result).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Household is not configured' }],
      });
      await expect(prisma.household.count()).resolves.toBe(0);
    } finally {
      household = await restoreHousehold(household);
    }
  });

  function createFixtureHousehold() {
    return prisma.household.create({
      data: {
        id: randomUUID(),
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: ['child', 'teen'],
        predictionPreferences: { preferRecentSignals: true },
        suggestionConfidenceThreshold: 0.8,
        productPolicies: { milk: { predictionEnabled: true } },
      },
    });
  }

  function restoreHousehold(snapshot: HouseholdModel) {
    return prisma.household.create({
      data: {
        id: snapshot.id,
        adultsCount: snapshot.adultsCount,
        childrenCount: snapshot.childrenCount,
        childAgeGroups: snapshot.childAgeGroups,
        predictionPreferences: snapshot.predictionPreferences ?? undefined,
        suggestionConfidenceThreshold: snapshot.suggestionConfidenceThreshold,
        productPolicies: snapshot.productPolicies ?? undefined,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
    });
  }
});
