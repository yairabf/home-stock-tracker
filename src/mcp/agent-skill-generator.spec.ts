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

  it('fails closed when a generated bundle was hand-edited', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'agent-skills-'));

    try {
      cpSync(
        join(projectRoot, 'integrations'),
        join(temporaryRoot, 'integrations'),
        { recursive: true },
      );
      const generatedSkill = join(
        temporaryRoot,
        'integrations/openclaw/home-stock-tracker/SKILL.md',
      );
      appendFileSync(generatedSkill, '\nHand-edited drift.\n');

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
      expect(result.stderr).toContain('Generated agent skill files are stale');
      expect(result.stderr).toContain(
        'integrations/openclaw/home-stock-tracker/SKILL.md',
      );
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
