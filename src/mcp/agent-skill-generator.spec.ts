import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const LOCAL_PYTHON_ARTIFACTS = new Set([
  '.pytest_cache',
  '.venv',
  '__pycache__',
]);

describe('agent skill generator', () => {
  const projectRoot = process.cwd();

  it('keeps both generated platform bundles current and separated', () => {
    const result = spawnSync(
      process.execPath,
      [join(projectRoot, 'scripts/generate-agent-skills.mjs'), '--check'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);

    const hermesSkill = readFileSync(
      join(projectRoot, 'integrations/hermes/home-stock-tracker/SKILL.md'),
      'utf8',
    );
    const openClawSkill = readFileSync(
      join(projectRoot, 'integrations/openclaw/home-stock-tracker/SKILL.md'),
      'utf8',
    );

    expect(hermesSkill).toContain('`grocery_add`');
    expect(openClawSkill).toContain('`grocery_add`');
    expect(hermesSkill).toContain('[SILENT]');
    expect(openClawSkill).not.toMatch(/Hermes|WhatsApp|\[SILENT\]|hermes cron/);
  });

  it.each([
    'SKILL.md',
    'scenarios.md',
    'manifest.json',
    'release/README.md',
    'contracts/1.4.0/tools-list.json',
  ])('fails closed when generated %s was hand-edited', (artifact) => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'agent-skills-'));

    try {
      cpSync(
        join(projectRoot, 'integrations'),
        join(temporaryRoot, 'integrations'),
        {
          recursive: true,
          filter: (source) => !LOCAL_PYTHON_ARTIFACTS.has(basename(source)),
        },
      );
      cpSync(
        join(projectRoot, 'package.json'),
        join(temporaryRoot, 'package.json'),
      );
      cpSync(
        join(projectRoot, 'package-lock.json'),
        join(temporaryRoot, 'package-lock.json'),
      );
      cpSync(
        join(projectRoot, 'src/mcp/agent-release-contract.generated.ts'),
        join(temporaryRoot, 'src/mcp/agent-release-contract.generated.ts'),
        { recursive: true },
      );
      const generatedArtifact = join(
        temporaryRoot,
        'integrations/openclaw/home-stock-tracker',
        artifact,
      );
      appendFileSync(generatedArtifact, '\nHand-edited drift.\n');

      const result = spawnSync(
        process.execPath,
        [
          join(projectRoot, 'scripts/generate-agent-skills.mjs'),
          '--check',
          '--project-root',
          temporaryRoot,
        ],
        { cwd: projectRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Generated agent release files are stale',
      );
      expect(result.stderr).toContain(
        `integrations/openclaw/home-stock-tracker/${artifact}`,
      );
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
  it('bootstraps runtime metadata before a new immutable fixture exists', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'agent-runtime-'));
    try {
      const shared = join(
        temporaryRoot,
        'integrations/shared/home-stock-tracker',
      );
      mkdirSync(shared, { recursive: true });
      const contract = JSON.parse(
        readFileSync(
          join(
            projectRoot,
            'integrations/shared/home-stock-tracker/release-contract.json',
          ),
          'utf8',
        ),
      );
      contract.mcp.contractVersion = '1.99.0';
      contract.mcp.toolsFixture = 'contracts/1.99.0/tools-list.json';
      writeFileSync(
        join(shared, 'release-contract.json'),
        JSON.stringify(contract),
      );
      const result = spawnSync(
        process.execPath,
        [
          join(projectRoot, 'scripts/generate-agent-skills.mjs'),
          '--runtime-only',
          '--project-root',
          temporaryRoot,
        ],
        { cwd: projectRoot, encoding: 'utf8' },
      );
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(
        readFileSync(
          join(temporaryRoot, 'src/mcp/agent-release-contract.generated.ts'),
          'utf8',
        ),
      ).toContain("contractVersion: '1.99.0'");
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
