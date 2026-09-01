import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function readSource(...parts) {
  return readFileSync(join(sharedRoot, ...parts), 'utf8').trimEnd();
}

function renderShared(source, marker, platformContent) {
  return `${source.replace(marker, platformContent.trim()).trimEnd()}\n`;
}

export function renderAgentSkill(platform) {
  const frontmatter = readSource('platforms', platform, 'skill-frontmatter.md');
  const workflow = renderShared(
    readSource('workflow.md'),
    '<!-- PLATFORM_WORKFLOW -->',
    readSource('platforms', platform, 'workflow.md'),
  );

  return `${frontmatter}\n\n${workflow}`;
}

export function renderAgentScenarios(platform) {
  return renderShared(
    readSource('scenarios.md'),
    '<!-- PLATFORM_SCENARIOS -->',
    readSource('platforms', platform, 'scenarios.md'),
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
    ];
  });
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
    console.error('Generated agent skill files are stale:');
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
  const bundles = generatedBundles();
  if (process.argv.includes('--check')) {
    checkBundles(bundles);
  } else {
    writeBundles(bundles);
  }
}
