import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadReleaseContract } from './agent-release-contract.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const releaseContract = loadReleaseContract(projectRoot);
const platforms = ['hermes', 'openclaw'];
const authoredPublicDocs = [
  'README.md',
  'docs/agent-integrations.md',
  ...platforms.map(
    (platform) => `integrations/${platform}/home-stock-tracker/README.md`,
  ),
];
const NUMBER_WORD =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)';
const TOOL_COUNT_PATTERN = new RegExp(
  `\\b(?:\\d+|${NUMBER_WORD})\\s+(?:MCP\\s+)?tools\\b`,
  'i',
);
const SEMVER_PATTERN = /\b\d+\.\d+\.\d+\b/;

function fail(message) {
  throw new Error(`Agent documentation contract failed: ${message}`);
}

function read(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

for (const path of authoredPublicDocs) {
  const content = read(path);
  if (TOOL_COUNT_PATTERN.test(content)) {
    fail(`${path} contains a hardcoded tool count; reference the manifest`);
  }
  if (SEMVER_PATTERN.test(content)) {
    fail(`${path} contains an independently maintained release version`);
  }
}

const integrationGuide = read('docs/agent-integrations.md');
const normalizedIntegrationGuide = integrationGuide.replace(/\s+/g, ' ');
for (const platform of platforms) {
  const bundleRoot = `integrations/${platform}/home-stock-tracker`;
  const manifest = JSON.parse(read(`${bundleRoot}/manifest.json`));
  const command = `npm run agent:probe -- --platform ${platform}`;
  const platformReadme = read(`${bundleRoot}/README.md`);
  const releaseReadme = read(`${bundleRoot}/release/README.md`);

  if (manifest.verification?.command !== command) {
    fail(`${bundleRoot}/manifest.json does not publish ${command}`);
  }
  for (const [path, content] of [
    ['docs/agent-integrations.md', integrationGuide],
    [`${bundleRoot}/README.md`, platformReadme],
    [`${bundleRoot}/release/README.md`, releaseReadme],
  ]) {
    if (!content.includes(command)) {
      fail(`${path} does not publish ${command}`);
    }
  }
  if (
    manifest.mcp.contractVersion !== releaseContract.mcp.contractVersion ||
    manifest.skill.version !== releaseContract.skill.version ||
    manifest.service.version !== releaseContract.service.version
  ) {
    fail(
      `${bundleRoot}/manifest.json versions drift from the release contract`,
    );
  }
}

for (const requiredText of [
  'For a generic client',
  'breaking tool/schema changes',
  'minor for additive contract changes',
  'patch for non-contract corrections',
  'Restore the entire platform bundle',
  'Never combine files from different bundle versions',
]) {
  if (!normalizedIntegrationGuide.includes(requiredText)) {
    fail(`docs/agent-integrations.md is missing: ${requiredText}`);
  }
}

process.stdout.write('Agent documentation contract is valid.\n');
