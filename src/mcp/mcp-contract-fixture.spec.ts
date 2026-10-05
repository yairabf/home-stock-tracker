import type { StockProductConfirmationService } from '../inventory/stock-product-confirmation.service';
import type { ExpirationBatchService } from '../inventory/expiration-batch.service';
import type { ExpirationRecommendationService } from '../inventory/expiration-recommendation.service';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { GroceryService } from '../grocery/grocery.service';
import type { InventoryService } from '../inventory/inventory.service';
import type { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';
import type { PredictionFeedbackService } from '../inventory/prediction-feedback.service';
import type { OperationalLogger } from '../observability/operational-logger.service';
import type { ProductSearchService } from '../product/product-search.service';
import type { ProductService } from '../product/product.service';
import type { HouseholdService } from '../household/household.service';
import { AGENT_RELEASE_CONTRACT } from './agent-release-contract.generated';
import {
  discoverMcpContractSnapshot,
  normalizeMcpContractSnapshot,
  readMcpContractSnapshot,
  writeNewMcpContractSnapshot,
  type McpContractSnapshot,
} from './mcp-contract-fixture';
import { McpServerFactory } from './mcp-server.factory';

describe('MCP contract fixture', () => {
  const projectRoot = process.cwd();
  const fixturePath = join(
    projectRoot,
    'integrations/shared/home-stock-tracker',
    AGENT_RELEASE_CONTRACT.mcp.toolsFixture,
  );
  let client: Client;
  let closeServer: () => Promise<void>;
  let snapshot: McpContractSnapshot;

  beforeAll(async () => {
    const factory = new McpServerFactory(
      {} as GroceryService,
      {} as ProductService,
      {} as ProductSearchService,
      {} as InventoryService,
      {} as PredictionFeedbackService,
      {} as LowStockRecommendationService,
      {} as HouseholdService,
      {} as OperationalLogger,
      {} as StockProductConfirmationService,
      {} as ExpirationBatchService,
      {} as ExpirationRecommendationService,
    );
    const server = factory.create();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'contract-fixture-client', version: '1.0.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    closeServer = async () => {
      await client.close();
      await server.close();
    };
    snapshot = await discoverMcpContractSnapshot(client);
  });

  afterAll(async () => closeServer());

  it('matches or explicitly captures the current versioned fixture', () => {
    if (process.env.MCP_CONTRACT_CAPTURE === '1') {
      writeNewMcpContractSnapshot(fixturePath, snapshot);
      return;
    }

    expect(snapshot).toEqual(readMcpContractSnapshot(fixturePath));
  });

  it('publishes exactly the tools required by the release contract', () => {
    expect(snapshot.tools.map(({ name }) => name).sort()).toEqual(
      [...AGENT_RELEASE_CONTRACT.requiredTools].sort(),
    );
  });

  it('widens only approved perishability outputs after contract 1.8.0', () => {
    const previous = readMcpContractSnapshot(
      join(
        projectRoot,
        'integrations/shared/home-stock-tracker/contracts/1.8.0/tools-list.json',
      ),
    );
    const widened: string[] = [];
    function widen(oldValue: unknown, current: unknown, path = ''): unknown {
      if (Array.isArray(oldValue))
        return oldValue.map((value, index) =>
          widen(value, (current as unknown[])[index], `${path}/${index}`),
        );
      if (!oldValue || typeof oldValue !== 'object') return oldValue;
      const oldObject = oldValue as Record<string, unknown>;
      const newObject = current as Record<string, unknown>;
      if (
        path.endsWith('/isPerishable') &&
        path.includes('/outputSchema/') &&
        JSON.stringify(newObject) ===
          JSON.stringify({ anyOf: [{ type: 'boolean' }, { type: 'null' }] })
      ) {
        expect(oldObject).toEqual({ type: 'boolean' });
        widened.push(path);
        return newObject;
      }
      return Object.fromEntries(
        Object.entries(oldObject).map(([key, value]) => [
          key,
          widen(value, newObject?.[key], `${path}/${key}`),
        ]),
      );
    }
    expect(widen(previous.tools, snapshot.tools)).toEqual(snapshot.tools);
    expect(widened.length).toBeGreaterThan(0);
  });

  it('normalizes tool ordering before comparison', () => {
    expect(
      normalizeMcpContractSnapshot(
        snapshot.serverInfo,
        [...snapshot.tools].reverse(),
      ),
    ).toEqual(snapshot);
  });

  it('refuses to overwrite an existing contract version', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-contract-fixture-'));
    const temporaryFixture = join(temporaryRoot, 'tools-list.json');

    try {
      writeNewMcpContractSnapshot(temporaryFixture, snapshot);
      expect(() =>
        writeNewMcpContractSnapshot(temporaryFixture, snapshot),
      ).toThrow('Refusing to overwrite released MCP contract fixture');
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
