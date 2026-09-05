import { spawn } from 'node:child_process';
import { createServer, type Server as HttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Implementation,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express, { type Request, type Response } from 'express';
import { AGENT_RELEASE_CONTRACT } from './agent-release-contract.generated';

interface ProbeProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
  args: string[];
}

interface ProbeServerState {
  healthStatus: number;
  readinessStatus: number;
  mcpStatus: number | null;
  expectedToken: string;
  serverInfo: Implementation;
  tools: Tool[];
  safeReadError: boolean;
  householdContext: Record<string, unknown>;
  calledTools: string[];
}

const householdContext = {
  id: '00000000-0000-4000-8000-000000000010',
  adultsCount: 2,
  childrenCount: 3,
  childAgeGroups: ['child', 'teen'],
  predictionPreferences: { diagnosticSecret: 'do-not-print-preferences' },
  suggestionConfidenceThreshold: 0.8,
  productPolicies: { diagnosticSecret: 'do-not-print-policies' },
};

describe('read-only agent installation probe', () => {
  const projectRoot = process.cwd();
  const probeScript = join(projectRoot, 'scripts/agent-installation-probe.mjs');
  const canonicalFixture = JSON.parse(
    readFileSync(
      join(
        projectRoot,
        'integrations/shared/home-stock-tracker',
        AGENT_RELEASE_CONTRACT.mcp.toolsFixture,
      ),
      'utf8',
    ),
  ) as { serverInfo: Implementation; tools: Tool[] };
  const state: ProbeServerState = {
    healthStatus: 200,
    readinessStatus: 200,
    mcpStatus: null,
    expectedToken: 'probe-test-credential',
    serverInfo: canonicalFixture.serverInfo,
    tools: canonicalFixture.tools,
    safeReadError: false,
    householdContext,
    calledTools: [],
  };
  let server: HttpServer;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.get('/health', (_request, response) => {
      response
        .status(state.healthStatus)
        .json({ status: state.healthStatus === 200 ? 'ok' : 'error' });
    });
    app.get('/ready', (_request, response) => {
      response.status(state.readinessStatus).json({
        status: state.readinessStatus === 200 ? 'ok' : 'error',
        checks: {
          database: state.readinessStatus === 200 ? 'up' : 'down',
        },
      });
    });
    app.all('/mcp', (request: Request, response: Response) => {
      void handleMcpRequest(request, response, state);
    });

    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    state.healthStatus = 200;
    state.readinessStatus = 200;
    state.mcpStatus = null;
    state.expectedToken = 'probe-test-credential';
    state.serverInfo = canonicalFixture.serverInfo;
    state.tools = canonicalFixture.tools;
    state.safeReadError = false;
    state.householdContext = householdContext;
    state.calledTools = [];
  });

  async function runProbe(
    platform: 'hermes' | 'openclaw' = 'hermes',
    overrides: NodeJS.ProcessEnv = {},
    args = ['--platform', platform],
  ): Promise<ProbeProcessResult> {
    const environment = {
      ...process.env,
      HOME_STOCK_TRACKER_BASE_URL: baseUrl,
      HOME_STOCK_TRACKER_API_AUTH_TOKEN: 'probe-test-credential',
      ...overrides,
    };
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete environment[key];
    }

    return new Promise((resolve) => {
      const child = spawn(process.execPath, [probeScript, ...args], {
        cwd: projectRoot,
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('close', (status) =>
        resolve({ status, stdout, stderr, args: [probeScript, ...args] }),
      );
    });
  }

  it.each(['hermes', 'openclaw'] as const)(
    'verifies a healthy %s bundle through one safe read',
    async (platform) => {
      const result = await runProbe(platform);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain(`PROBE_OK code=OK platform=${platform}`);
      expect(result.stdout).toContain(`household ${householdContext.id}`);
      expect(state.calledTools).toEqual(['get_household_context']);
      expect(result.args).not.toContain('probe-test-credential');
      expect(result.stdout).not.toContain('probe-test-credential');
      expect(result.stdout).not.toContain('do-not-print-preferences');
      expect(result.stdout).not.toContain('do-not-print-policies');
    },
  );

  it('rejects missing configuration and secret command-line arguments', async () => {
    const missing = await runProbe('hermes', {
      HOME_STOCK_TRACKER_BASE_URL: undefined,
      HOME_STOCK_TRACKER_API_AUTH_TOKEN: undefined,
    });
    const secret = 'command-line-secret-value';
    const invalidArguments = await runProbe('hermes', {}, [
      '--platform',
      'hermes',
      '--token',
      secret,
    ]);

    expect(missing.status).toBe(10);
    expect(missing.stderr).toContain('code=MISSING_CONFIGURATION');
    expect(invalidArguments.status).toBe(2);
    expect(invalidArguments.stderr).toContain('code=INVALID_ARGUMENTS');
    expect(invalidArguments.stderr).not.toContain(secret);
  });

  it('distinguishes unreachable, unhealthy, and unready endpoints', async () => {
    const unreachable = await runProbe('hermes', {
      HOME_STOCK_TRACKER_BASE_URL: 'http://127.0.0.1:1',
    });
    state.healthStatus = 500;
    const unhealthy = await runProbe();
    state.healthStatus = 200;
    state.readinessStatus = 503;
    const unready = await runProbe();

    expect(unreachable.status).toBe(20);
    expect(unreachable.stderr).toContain('code=ENDPOINT_UNREACHABLE');
    expect(unhealthy.status).toBe(21);
    expect(unhealthy.stderr).toContain('code=HEALTH_FAILED');
    expect(unready.status).toBe(22);
    expect(unready.stderr).toContain('code=READINESS_FAILED');
  });

  it('distinguishes authentication failure and disabled MCP', async () => {
    const credential = 'wrong-probe-credential';
    const unauthorized = await runProbe('hermes', {
      HOME_STOCK_TRACKER_API_AUTH_TOKEN: credential,
    });
    state.mcpStatus = 404;
    const disabled = await runProbe();

    expect(unauthorized.status).toBe(23);
    expect(unauthorized.stderr).toContain('code=AUTHENTICATION_FAILED');
    expect(unauthorized.stderr).not.toContain(credential);
    expect(disabled.status).toBe(24);
    expect(disabled.stderr).toContain('code=MCP_DISABLED');
  });

  it('distinguishes wrong server identity and version', async () => {
    state.serverInfo = { ...canonicalFixture.serverInfo, name: 'wrong-server' };
    const identity = await runProbe();
    state.serverInfo = { ...canonicalFixture.serverInfo, version: '2.0.0' };
    const version = await runProbe();

    expect(identity.status).toBe(25);
    expect(identity.stderr).toContain('code=SERVER_IDENTITY_MISMATCH');
    expect(version.status).toBe(26);
    expect(version.stderr).toContain('code=SERVER_VERSION_MISMATCH');
  });

  it('distinguishes hidden tools from schema drift', async () => {
    state.tools = canonicalFixture.tools.filter(
      ({ name }) => name !== 'list_inventory',
    );
    const hidden = await runProbe();
    state.tools = canonicalFixture.tools.map((tool, index) =>
      index === 0
        ? { ...tool, description: 'drifted schema description' }
        : tool,
    );
    const drift = await runProbe();

    expect(hidden.status).toBe(28);
    expect(hidden.stderr).toContain('code=HIDDEN_TOOLS');
    expect(drift.status).toBe(27);
    expect(drift.stderr).toContain('code=SCHEMA_DRIFT');
  });

  it('fails closed when the safe household read fails without trying a mutation', async () => {
    state.safeReadError = true;

    const result = await runProbe();

    expect(result.status).toBe(29);
    expect(result.stderr).toContain('code=SAFE_READ_FAILED');
    expect(state.calledTools).toEqual(['get_household_context']);
  });

  it('rejects an incomplete household context response', async () => {
    state.householdContext = { ...householdContext };
    delete state.householdContext.productPolicies;

    const result = await runProbe();

    expect(result.status).toBe(29);
    expect(result.stderr).toContain('code=SAFE_READ_FAILED');
    expect(state.calledTools).toEqual(['get_household_context']);
  });
});

async function handleMcpRequest(
  request: Request,
  response: Response,
  state: ProbeServerState,
): Promise<void> {
  if (state.mcpStatus !== null) {
    response.sendStatus(state.mcpStatus);
    return;
  }
  if (request.headers.authorization !== `Bearer ${state.expectedToken}`) {
    response.sendStatus(401);
    return;
  }

  const mcpServer = new Server(state.serverInfo, {
    capabilities: { tools: {} },
  });
  mcpServer.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: state.tools,
  }));
  mcpServer.setRequestHandler(CallToolRequestSchema, ({ params }) => {
    state.calledTools.push(params.name);
    if (params.name !== 'get_household_context' || state.safeReadError) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'safe read failed' }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(state.householdContext) }],
      structuredContent: state.householdContext,
    };
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } finally {
    await mcpServer.close();
  }
}
