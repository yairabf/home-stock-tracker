import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RANGE_PATTERN = /^>=(\d+\.\d+\.\d+) <(\d+\.\d+\.\d+)$/;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOOL_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const FORBIDDEN_KEY_PATTERN =
  /(token|secret|password|credential|url|household|recipient)/i;
const FORBIDDEN_VALUE_PATTERN = /(https?:\/\/|bearer\s|api[_-]?key|token=)/i;

const ROOT_KEYS = [
  'service',
  'mcp',
  'skill',
  'features',
  'requiredTools',
  'platforms',
  'bundle',
];
const SERVICE_KEYS = ['name', 'version'];
const MCP_KEYS = [
  'serverName',
  'contractVersion',
  'toolsFixture',
  'versionPolicy',
];
const VERSION_POLICY_KEYS = ['breaking', 'additive', 'nonContract'];
const SKILL_KEYS = [
  'name',
  'description',
  'version',
  'compatibleMcpRange',
  'author',
  'tags',
];
const BUNDLE_KEYS = [
  'schemaVersion',
  'authentication',
  'network',
  'verificationCommand',
  'rollback',
];
const AUTHENTICATION_KEYS = ['scheme', 'environmentVariable'];
const NETWORK_KEYS = [
  'baseUrlEnvironmentVariable',
  'healthPath',
  'readinessPath',
  'mcpPath',
  'transport',
];
const ROLLBACK_KEYS = ['strategy', 'guidance'];
const SUPPORTED_PLATFORMS = ['hermes', 'openclaw'];

function assertObject(value, path) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${path} must be an object`);
  }
}

function assertExactKeys(value, allowedKeys, path) {
  assertObject(value, path);
  const unknown = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );
  const forbidden = unknown.find((key) => FORBIDDEN_KEY_PATTERN.test(key));

  if (forbidden) {
    throw new Error(
      `${path}.${forbidden} is a forbidden secret or deployment field`,
    );
  }
  if (unknown.length > 0) {
    throw new Error(`${path} has unsupported field: ${unknown.join(', ')}`);
  }
  const missing = allowedKeys.filter((key) => !(key in value));
  if (missing.length > 0) {
    throw new Error(`${path} is missing field: ${missing.join(', ')}`);
  }
}

function parseSemver(value, path) {
  if (typeof value !== 'string' || !SEMVER_PATTERN.test(value)) {
    throw new Error(`${path} must be a stable semantic version`);
  }
  return value.split('.').map(Number);
}

function compareSemver(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function validateCompatibleRange(value, contractVersion) {
  const match = typeof value === 'string' ? RANGE_PATTERN.exec(value) : null;
  if (!match) {
    throw new Error(
      'skill.compatibleMcpRange must use the format >=x.y.z <x.y.z',
    );
  }

  const minimum = parseSemver(match[1], 'skill.compatibleMcpRange minimum');
  const maximum = parseSemver(match[2], 'skill.compatibleMcpRange maximum');
  const current = parseSemver(contractVersion, 'mcp.contractVersion');
  if (compareSemver(minimum, maximum) >= 0) {
    throw new Error(
      'skill.compatibleMcpRange must have an increasing boundary',
    );
  }
  if (
    compareSemver(current, minimum) < 0 ||
    compareSemver(current, maximum) >= 0
  ) {
    throw new Error('mcp.contractVersion is outside skill.compatibleMcpRange');
  }
}

function validateUniqueStrings(values, path, pattern) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }

  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value)) {
      throw new Error(`${path} contains an invalid identifier`);
    }
    if (seen.has(value)) {
      throw new Error(`${path} contains duplicate identifier: ${value}`);
    }
    seen.add(value);
  }
}

function validateSafeStrings(value, path = 'contract') {
  if (typeof value === 'string') {
    if (FORBIDDEN_VALUE_PATTERN.test(value)) {
      throw new Error(
        `${path} contains a forbidden secret or deployment value`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      validateSafeStrings(entry, `${path}[${index}]`),
    );
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) =>
      validateSafeStrings(entry, `${path}.${key}`),
    );
  }
}

export function validateReleaseContract(contract) {
  assertExactKeys(contract, ROOT_KEYS, 'contract');
  assertExactKeys(contract.service, SERVICE_KEYS, 'service');
  assertExactKeys(contract.mcp, MCP_KEYS, 'mcp');
  assertExactKeys(
    contract.mcp.versionPolicy,
    VERSION_POLICY_KEYS,
    'mcp.versionPolicy',
  );
  assertExactKeys(contract.skill, SKILL_KEYS, 'skill');
  assertExactKeys(contract.bundle, BUNDLE_KEYS, 'bundle');
  assertExactKeys(
    contract.bundle.authentication,
    AUTHENTICATION_KEYS,
    'bundle.authentication',
  );
  assertExactKeys(contract.bundle.network, NETWORK_KEYS, 'bundle.network');
  assertExactKeys(contract.bundle.rollback, ROLLBACK_KEYS, 'bundle.rollback');

  if (contract.service.name !== 'home-stock-tracker') {
    throw new Error('service.name must be home-stock-tracker');
  }
  if (contract.mcp.serverName !== contract.service.name) {
    throw new Error('mcp.serverName must match service.name');
  }
  if (contract.skill.name !== contract.service.name) {
    throw new Error('skill.name must match service.name');
  }
  for (const field of ['description', 'author']) {
    if (
      typeof contract.skill[field] !== 'string' ||
      contract.skill[field].trim().length === 0
    ) {
      throw new Error(`skill.${field} must be a non-empty string`);
    }
  }

  parseSemver(contract.service.version, 'service.version');
  parseSemver(contract.mcp.contractVersion, 'mcp.contractVersion');
  parseSemver(contract.skill.version, 'skill.version');
  validateCompatibleRange(
    contract.skill.compatibleMcpRange,
    contract.mcp.contractVersion,
  );

  const expectedFixture = `contracts/${contract.mcp.contractVersion}/tools-list.json`;
  if (contract.mcp.toolsFixture !== expectedFixture) {
    throw new Error(`mcp.toolsFixture must be ${expectedFixture}`);
  }
  const expectedPolicy = {
    breaking: 'major',
    additive: 'minor',
    nonContract: 'patch',
  };
  for (const [changeType, increment] of Object.entries(expectedPolicy)) {
    if (contract.mcp.versionPolicy[changeType] !== increment) {
      throw new Error(`mcp.versionPolicy.${changeType} must be ${increment}`);
    }
  }

  validateUniqueStrings(contract.features, 'features', IDENTIFIER_PATTERN);
  validateUniqueStrings(contract.requiredTools, 'requiredTools', TOOL_PATTERN);
  validateUniqueStrings(contract.platforms, 'platforms', IDENTIFIER_PATTERN);
  validateUniqueStrings(contract.skill.tags, 'skill.tags', IDENTIFIER_PATTERN);
  if (
    contract.platforms.length !== SUPPORTED_PLATFORMS.length ||
    !SUPPORTED_PLATFORMS.every((platform) =>
      contract.platforms.includes(platform),
    )
  ) {
    throw new Error('platforms must contain exactly hermes and openclaw');
  }

  if (contract.bundle.schemaVersion !== 1) {
    throw new Error('bundle.schemaVersion must be 1');
  }
  if (
    contract.bundle.authentication.scheme !== 'bearer' ||
    contract.bundle.authentication.environmentVariable !==
      'HOME_STOCK_TRACKER_API_AUTH_TOKEN'
  ) {
    throw new Error(
      'bundle.authentication must use the documented environment variable',
    );
  }
  const expectedNetwork = {
    baseUrlEnvironmentVariable: 'HOME_STOCK_TRACKER_BASE_URL',
    healthPath: '/health',
    readinessPath: '/ready',
    mcpPath: '/mcp',
    transport: 'streamable-http',
  };
  for (const [field, expected] of Object.entries(expectedNetwork)) {
    if (contract.bundle.network[field] !== expected) {
      throw new Error(`bundle.network.${field} must be ${expected}`);
    }
  }
  if (
    contract.bundle.verificationCommand !==
    'npm run agent:probe -- --platform {{PLATFORM}}'
  ) {
    throw new Error(
      'bundle.verificationCommand must be the platform probe template',
    );
  }
  if (
    contract.bundle.rollback.strategy !== 'replace-complete-bundle' ||
    typeof contract.bundle.rollback.guidance !== 'string' ||
    contract.bundle.rollback.guidance.trim().length === 0
  ) {
    throw new Error('bundle.rollback must define complete-bundle restoration');
  }

  validateSafeStrings(contract);
  return contract;
}

export function loadReleaseContractFile(contractPath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(contractPath, 'utf8'));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown parse error';
    throw new Error(`Cannot read release contract: ${message}`);
  }
  return validateReleaseContract(parsed);
}

export function loadReleaseContract(projectRoot) {
  return loadReleaseContractFile(
    join(
      projectRoot,
      'integrations',
      'shared',
      'home-stock-tracker',
      'release-contract.json',
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const contractPath = process.argv[2]
    ? resolve(process.argv[2])
    : join(
        defaultRoot,
        'integrations',
        'shared',
        'home-stock-tracker',
        'release-contract.json',
      );

  try {
    loadReleaseContractFile(contractPath);
    process.stdout.write('Release contract is valid.\n');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid release contract';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
