import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { loadReleaseContract } from './agent-release-contract.mjs';
import {
  loadScenarioContract,
  renderScenarioTable,
} from './agent-scenarios.mjs';

const projectRootArgument = process.argv.indexOf('--project-root');
const projectRoot =
  projectRootArgument === -1
    ? join(dirname(fileURLToPath(import.meta.url)), '..')
    : resolve(process.argv[projectRootArgument + 1]);
const sharedRoot = join(
  projectRoot,
  'integrations',
  'shared',
  'home-stock-tracker',
);
const platforms = ['hermes', 'openclaw'];
const releaseContract = loadReleaseContract(projectRoot);
const scenarioContract = loadScenarioContract(projectRoot);

function readSource(...parts) {
  return readFileSync(join(sharedRoot, ...parts), 'utf8').trimEnd();
}

function renderShared(source, marker, platformContent) {
  return `${source.replace(marker, platformContent.trim()).trimEnd()}\n`;
}

export function renderAgentSkill(platform) {
  const replacements = {
    '{{SKILL_NAME}}': releaseContract.skill.name,
    '{{SKILL_DESCRIPTION}}': releaseContract.skill.description,
    '{{SKILL_VERSION}}': releaseContract.skill.version,
    '{{SKILL_AUTHOR}}': releaseContract.skill.author,
    '{{SKILL_TAGS}}': releaseContract.skill.tags.join(', '),
  };
  let frontmatter = readSource('platforms', platform, 'skill-frontmatter.md');
  for (const [placeholder, value] of Object.entries(replacements)) {
    frontmatter = frontmatter.replaceAll(placeholder, value);
  }
  const workflow = renderShared(
    readSource('workflow.md'),
    '<!-- PLATFORM_WORKFLOW -->',
    readSource('platforms', platform, 'workflow.md'),
  );

  return `${frontmatter}\n\n${workflow}`;
}

export function renderBundleManifest(platform) {
  const verificationCommand =
    releaseContract.bundle.verificationCommand.replace(
      '{{PLATFORM}}',
      platform,
    );

  return `${JSON.stringify(
    {
      schemaVersion: releaseContract.bundle.schemaVersion,
      platform,
      service: releaseContract.service,
      skill: {
        name: releaseContract.skill.name,
        version: releaseContract.skill.version,
      },
      mcp: {
        serverName: releaseContract.mcp.serverName,
        contractVersion: releaseContract.mcp.contractVersion,
        compatibleRange: releaseContract.skill.compatibleMcpRange,
        toolsFixture: releaseContract.mcp.toolsFixture,
        versionPolicy: releaseContract.mcp.versionPolicy,
      },
      features: releaseContract.features,
      requiredTools: releaseContract.requiredTools,
      prerequisites: {
        authentication: releaseContract.bundle.authentication,
        network: releaseContract.bundle.network,
      },
      verification: {
        command: verificationCommand,
      },
      rollback: releaseContract.bundle.rollback,
    },
    null,
    2,
  )}\n`;
}

export function renderBundleContractReadme(platform) {
  const platformName = platform === 'openclaw' ? 'OpenClaw' : 'Hermes';
  const tools = releaseContract.requiredTools
    .map((tool) => `- \`${tool}\``)
    .join('\n');
  const { authentication, network, rollback } = releaseContract.bundle;
  const verificationCommand =
    releaseContract.bundle.verificationCommand.replace(
      '{{PLATFORM}}',
      platform,
    );

  return `# Home Stock Tracker ${platformName} release contract

This generated release metadata belongs to the \`${platform}\` bundle. Keep
\`manifest.json\`, \`SKILL.md\`, \`scenarios.md\`, and the \`${releaseContract.mcp.toolsFixture}\`
fixture from the same generated release.

## Compatibility

- Skill version: \`${releaseContract.skill.version}\`
- MCP server: \`${releaseContract.mcp.serverName}\`
- MCP contract: \`${releaseContract.mcp.contractVersion}\`
- Compatible MCP range: \`${releaseContract.skill.compatibleMcpRange}\`

## Prerequisites

- Supply the service base address at verification time through
  \`${network.baseUrlEnvironmentVariable}\`.
- Supply authentication at verification time through
  \`${authentication.environmentVariable}\` using the \`${authentication.scheme}\` scheme.
- Permit network access to \`${network.healthPath}\`, \`${network.readinessPath}\`, and
  \`${network.mcpPath}\` over \`${network.transport}\`.
- Keep environment values outside this bundle and out of command arguments,
  generated files, screenshots, and shared logs.

## Required MCP tools

${tools}

## Verification

From the project checkout, run:

\`\`\`bash
${verificationCommand}
\`\`\`

This verifies health, readiness, authentication, MCP identity and compatibility,
the exact normalized tool schemas, the required tool set, and one read-only
\`grocery_list\` call. It never invokes a mutation. Run \`npm run contract:check\`
before publishing from a project checkout to reject stale generated artifacts.

## Rollback

Strategy: \`${rollback.strategy}\`.

${rollback.guidance}
`;
}

export function renderAgentScenarios(platform) {
  const sharedScenarios = readSource('scenarios.md').replace(
    '<!-- EXECUTABLE_GROCERY_CATALOG_SCENARIOS -->',
    renderScenarioTable(scenarioContract, platform),
  );
  const platformScenarios = readSource(
    'platforms',
    platform,
    'scenarios.md',
  ).replace(
    '<!-- EXECUTABLE_PLATFORM_SCENARIOS -->',
    renderScenarioTable(scenarioContract, platform, true),
  );
  return renderShared(
    sharedScenarios,
    '<!-- PLATFORM_SCENARIOS -->',
    platformScenarios,
  );
}

export function generatedBundles() {
  return platforms.flatMap((platform) => {
    const targetRoot = join(
      projectRoot,
      'integrations',
      platform,
      'home-stock-tracker',
    );

    return [
      {
        path: join(targetRoot, 'SKILL.md'),
        content: renderAgentSkill(platform),
      },
      {
        path: join(targetRoot, 'scenarios.md'),
        content: renderAgentScenarios(platform),
      },
      {
        path: join(targetRoot, 'manifest.json'),
        content: renderBundleManifest(platform),
      },
      {
        path: join(targetRoot, 'release', 'README.md'),
        content: renderBundleContractReadme(platform),
      },
      {
        path: join(targetRoot, releaseContract.mcp.toolsFixture),
        content: `${readSource(releaseContract.mcp.toolsFixture)}\n`,
      },
    ];
  });
}

function renderJsonWithVersion(path, version, packageLock = false) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  value.version = version;
  if (packageLock) {
    value.packages[''].version = version;
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function renderRuntimeContract() {
  return format(
    `// Generated by scripts/generate-agent-skills.mjs. Do not edit directly.
export const AGENT_RELEASE_CONTRACT = ${JSON.stringify(releaseContract, null, 2)} as const;

export const MCP_SERVER_INFO = {
  name: AGENT_RELEASE_CONTRACT.mcp.serverName,
  version: AGENT_RELEASE_CONTRACT.mcp.contractVersion,
} as const;
`,
    { parser: 'typescript', singleQuote: true },
  );
}

export async function generatedReleaseArtifacts() {
  const packagePath = join(projectRoot, 'package.json');
  const packageLockPath = join(projectRoot, 'package-lock.json');

  return [
    ...generatedBundles(),
    {
      path: packagePath,
      content: renderJsonWithVersion(
        packagePath,
        releaseContract.service.version,
      ),
    },
    {
      path: packageLockPath,
      content: renderJsonWithVersion(
        packageLockPath,
        releaseContract.service.version,
        true,
      ),
    },
    {
      path: join(projectRoot, 'src/mcp/agent-release-contract.generated.ts'),
      content: await renderRuntimeContract(),
    },
  ];
}

export function staleBundles(bundles) {
  return bundles.filter(({ path, content }) => {
    try {
      return readFileSync(path, 'utf8') !== content;
    } catch {
      return true;
    }
  });
}

function checkBundles(bundles) {
  const stale = staleBundles(bundles);

  if (stale.length > 0) {
    console.error('Generated agent release files are stale:');
    stale.forEach(({ path }) => console.error(`- ${path}`));
    process.exitCode = 1;
  }
}

function writeBundles(bundles) {
  bundles.forEach(({ path, content }) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bundles = await generatedReleaseArtifacts();
  if (process.argv.includes('--check')) {
    checkBundles(bundles);
  } else {
    writeBundles(bundles);
  }
}
