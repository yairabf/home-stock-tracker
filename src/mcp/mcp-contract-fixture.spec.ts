import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { PredictionEngine } from '../estimation/prediction-engine';
import type { GroceryService } from '../grocery/grocery.service';
import type { InventoryService } from '../inventory/inventory.service';
import type { LowStockRecommendationService } from '../inventory/low-stock-recommendation.service';
import type { PredictionFeedbackService } from '../inventory/prediction-feedback.service';
import type { OperationalLogger } from '../observability/operational-logger.service';
import type { ProductSearchService } from '../product/product-search.service';
import type { ProductService } from '../product/product.service';
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
      {} as PredictionEngine,
      {} as InventoryService,
      {} as PredictionFeedbackService,
      {} as LowStockRecommendationService,
      {} as OperationalLogger,
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
