import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const EXIT_CODES = Object.freeze({
  success: 0,
  invalidArguments: 2,
  missingConfiguration: 10,
  invalidConfiguration: 11,
  bundleInvalid: 12,
  endpointUnreachable: 20,
  healthFailed: 21,
  readinessFailed: 22,
  authenticationFailed: 23,
  mcpDisabled: 24,
  serverIdentityMismatch: 25,
  serverVersionMismatch: 26,
  schemaDrift: 27,
  hiddenTools: 28,
  safeReadFailed: 29,
  mcpConnectionFailed: 30,
  internalFailure: 31,
});

const DIAGNOSTICS = Object.freeze({
  INVALID_ARGUMENTS: [
    EXIT_CODES.invalidArguments,
    'Use exactly --platform hermes or --platform openclaw; configuration belongs in environment variables.',
  ],
  MISSING_CONFIGURATION: [
    EXIT_CODES.missingConfiguration,
    'Set HOME_STOCK_TRACKER_BASE_URL and HOME_STOCK_TRACKER_API_AUTH_TOKEN.',
  ],
  INVALID_CONFIGURATION: [
    EXIT_CODES.invalidConfiguration,
    'Use a valid HTTP(S) base URL without embedded credentials and non-blank environment values.',
  ],
  BUNDLE_INVALID: [
    EXIT_CODES.bundleInvalid,
    'Regenerate the selected bundle and keep its manifest and contract fixture together.',
  ],
  ENDPOINT_UNREACHABLE: [
    EXIT_CODES.endpointUnreachable,
    'The service endpoints are unreachable; check network access and service availability.',
  ],
  HEALTH_FAILED: [
    EXIT_CODES.healthFailed,
    'The health endpoint did not report a healthy service.',
  ],
  READINESS_FAILED: [
    EXIT_CODES.readinessFailed,
    'The readiness endpoint did not report a ready service.',
  ],
  AUTHENTICATION_FAILED: [
    EXIT_CODES.authenticationFailed,
    'MCP authentication failed; verify the configured environment credential.',
  ],
  MCP_DISABLED: [
    EXIT_CODES.mcpDisabled,
    'The MCP endpoint is unavailable or disabled; enable it before installing the skill.',
  ],
  SERVER_IDENTITY_MISMATCH: [
    EXIT_CODES.serverIdentityMismatch,
    'The live MCP server name does not match the selected bundle.',
  ],
  SERVER_VERSION_MISMATCH: [
    EXIT_CODES.serverVersionMismatch,
    'The live MCP server version is outside the selected bundle contract.',
  ],
  SCHEMA_DRIFT: [
    EXIT_CODES.schemaDrift,
    'The live MCP tool schemas differ from the selected bundle fixture.',
  ],
  HIDDEN_TOOLS: [
    EXIT_CODES.hiddenTools,
    'One or more required MCP tools are hidden or unavailable to this installation.',
  ],
  SAFE_READ_FAILED: [
    EXIT_CODES.safeReadFailed,
    'The read-only grocery_list verification call failed; do not enable writes.',
  ],
  MCP_CONNECTION_FAILED: [
    EXIT_CODES.mcpConnectionFailed,
    'The MCP connection failed after health checks; inspect endpoint and transport configuration.',
  ],
  INTERNAL_FAILURE: [
    EXIT_CODES.internalFailure,
    'The probe failed safely without exposing configuration; regenerate the bundle and retry.',
  ],
});

function diagnostic(code) {
  const [exitCode, message] = DIAGNOSTICS[code];
  return { ok: false, code, exitCode, message };
}

function parseArguments(args) {
  if (
    args.length !== 2 ||
    args[0] !== '--platform' ||
    !['hermes', 'openclaw'].includes(args[1])
  ) {
    return null;
  }
  return args[1];
}

function parseConfiguration(environment) {
  const baseUrlValue = environment.HOME_STOCK_TRACKER_BASE_URL;
  const authToken = environment.HOME_STOCK_TRACKER_API_AUTH_TOKEN;
  if (!baseUrlValue || !authToken) return diagnostic('MISSING_CONFIGURATION');
  if (
    baseUrlValue.trim() !== baseUrlValue ||
    authToken.trim() !== authToken ||
    baseUrlValue.length === 0 ||
    authToken.length === 0
  ) {
    return diagnostic('INVALID_CONFIGURATION');
  }

  try {
    const baseUrl = new URL(baseUrlValue);
    if (
      !['http:', 'https:'].includes(baseUrl.protocol) ||
      baseUrl.username ||
      baseUrl.password
    ) {
      return diagnostic('INVALID_CONFIGURATION');
    }
    return { baseUrl, authToken };
  } catch {
    return diagnostic('INVALID_CONFIGURATION');
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeJson(entry)]),
    );
  }
  return value;
}

function normalizeSnapshot(serverInfo, tools) {
  return normalizeJson({
    serverInfo,
    tools: [...tools].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  });
}

function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function versionSatisfies(version, range) {
  const match = /^>=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)$/.exec(range);
  const current = parseVersion(version);
  if (!match || !current) return false;
  const minimum = parseVersion(match[1]);
  const maximum = parseVersion(match[2]);
  return (
    minimum &&
    maximum &&
    compareVersions(current, minimum) >= 0 &&
    compareVersions(current, maximum) < 0
  );
}

async function checkHttpEndpoint(fetchImpl, url, failureCode) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return diagnostic('ENDPOINT_UNREACHABLE');
  }
  if (!response.ok) return diagnostic(failureCode);
  try {
    const body = await response.json();
    if (body?.status !== 'ok') return diagnostic(failureCode);
  } catch {
    return diagnostic(failureCode);
  }
  return null;
}

function withTimeout(fetchImpl) {
  return (input, init = {}) => {
    const timeout = AbortSignal.timeout(5000);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    return fetchImpl(input, { ...init, signal });
  };
}

function classifyMcpConnectionError(error) {
  if (error instanceof StreamableHTTPError) {
    if (error.code === 401 || error.code === 403) {
      return diagnostic('AUTHENTICATION_FAILED');
    }
    if (error.code === 404 || error.code === 405) {
      return diagnostic('MCP_DISABLED');
    }
  }
  return diagnostic('MCP_CONNECTION_FAILED');
}

export async function runInstallationProbe({
  platform,
  environment = process.env,
  fetchImpl = fetch,
  projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..'),
}) {
  if (!['hermes', 'openclaw'].includes(platform)) {
    return diagnostic('INVALID_ARGUMENTS');
  }
  const configuration = parseConfiguration(environment);
  if ('ok' in configuration && configuration.ok === false) return configuration;

  let manifest;
  let expectedFixture;
  try {
    const bundleRoot = join(
      projectRoot,
      'integrations',
      platform,
      'home-stock-tracker',
    );
    manifest = readJson(join(bundleRoot, 'manifest.json'));
    expectedFixture = readJson(join(bundleRoot, manifest.mcp.toolsFixture));
    if (
      manifest.platform !== platform ||
      !Array.isArray(expectedFixture.tools)
    ) {
      return diagnostic('BUNDLE_INVALID');
    }
  } catch {
    return diagnostic('BUNDLE_INVALID');
  }

  const timedFetch = withTimeout(fetchImpl);

  const healthFailure = await checkHttpEndpoint(
    timedFetch,
    new URL(manifest.prerequisites.network.healthPath, configuration.baseUrl),
    'HEALTH_FAILED',
  );
  if (healthFailure) return healthFailure;
  const readinessFailure = await checkHttpEndpoint(
    timedFetch,
    new URL(
      manifest.prerequisites.network.readinessPath,
      configuration.baseUrl,
    ),
    'READINESS_FAILED',
  );
  if (readinessFailure) return readinessFailure;

  const client = new Client({
    name: 'home-stock-tracker-installation-probe',
    version: '1.0.0',
  });
  const transport = new StreamableHTTPClientTransport(
    new URL(manifest.prerequisites.network.mcpPath, configuration.baseUrl),
    {
      requestInit: {
        headers: { authorization: `Bearer ${configuration.authToken}` },
      },
      fetch: timedFetch,
    },
  );

  try {
    try {
      await client.connect(transport);
    } catch (error) {
      return classifyMcpConnectionError(error);
    }

    const serverInfo = client.getServerVersion();
    if (!serverInfo || serverInfo.name !== manifest.mcp.serverName) {
      return diagnostic('SERVER_IDENTITY_MISMATCH');
    }
    if (
      !versionSatisfies(serverInfo.version, manifest.mcp.compatibleRange) ||
      serverInfo.version !== expectedFixture.serverInfo.version
    ) {
      return diagnostic('SERVER_VERSION_MISMATCH');
    }

    let tools;
    try {
      ({ tools } = await client.listTools());
    } catch {
      return diagnostic('MCP_CONNECTION_FAILED');
    }
    const liveNames = new Set(tools.map(({ name }) => name));
    if (manifest.requiredTools.some((name) => !liveNames.has(name))) {
      return diagnostic('HIDDEN_TOOLS');
    }
    const actualSnapshot = normalizeSnapshot(serverInfo, tools);
    if (
      JSON.stringify(actualSnapshot) !==
      JSON.stringify(normalizeJson(expectedFixture))
    ) {
      return diagnostic('SCHEMA_DRIFT');
    }

    try {
      const result = await client.callTool({
        name: 'grocery_list',
        arguments: {},
      });
      if (
        result.isError ||
        result.structuredContent === null ||
        typeof result.structuredContent !== 'object' ||
        !Array.isArray(result.structuredContent.items)
      ) {
        return diagnostic('SAFE_READ_FAILED');
      }
    } catch {
      return diagnostic('SAFE_READ_FAILED');
    }

    return {
      ok: true,
      code: 'OK',
      exitCode: EXIT_CODES.success,
      message:
        'Health, readiness, MCP contract, required tools, and grocery_list read verified.',
    };
  } finally {
    try {
      await client.close();
    } catch {
      // Closing a failed stateless probe must not replace the stable diagnostic.
    }
  }
}

function renderDiagnostic(result, platform) {
  return `${result.ok ? 'PROBE_OK' : 'PROBE_ERROR'} code=${result.code} platform=${platform} message=${JSON.stringify(result.message)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platform = parseArguments(process.argv.slice(2));
  let result;
  try {
    result = platform
      ? await runInstallationProbe({ platform })
      : diagnostic('INVALID_ARGUMENTS');
  } catch {
    result = diagnostic('INTERNAL_FAILURE');
  }
  const output = renderDiagnostic(result, platform ?? 'invalid');
  if (result.ok) console.log(output);
  else console.error(output);
  process.exitCode = result.exitCode;
}
