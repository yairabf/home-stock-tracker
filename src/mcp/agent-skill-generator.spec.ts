import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    'contracts/1.2.0/tools-list.json',
  ])('fails closed when generated %s was hand-edited', (artifact) => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'agent-skills-'));

    try {
      cpSync(
        join(projectRoot, 'integrations'),
        join(temporaryRoot, 'integrations'),
        { recursive: true },
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
});
