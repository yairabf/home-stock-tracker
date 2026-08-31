import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Hermes grocery duplicate workflow contract', () => {
  const integrationRoot = join(
    process.cwd(),
    'integrations/hermes/home-stock-tracker',
  );
  const skill = readFileSync(join(integrationRoot, 'SKILL.md'), 'utf8');
  const scenarios = readFileSync(join(integrationRoot, 'scenarios.md'), 'utf8');
  const readme = readFileSync(join(integrationRoot, 'README.md'), 'utf8');

  it('documents final-value updates after confirmation', () => {
    expect(skill).toMatch(/\| `grocery_update`\s+\|/);
    expect(skill).toContain('`confirmation_required`');
    expect(skill).toContain('final `requestedQuantity`');
    expect(skill).toContain('`expectedRequestedQuantity`');
    expect(skill).toContain('`expectedUnit`');
    expect(skill).toContain('`expectedNote`');
    expect(skill).toContain('Never ask the service to perform arithmetic.');
    expect(skill).toContain('`ifPendingExists: "create_separate"`');
    expect(readme).toContain('calculate that total');
    expect(skill).not.toContain('`quantityMode`');
  });

  it.each([
    'Duplicate cancellation',
    'Duplicate with final quantity',
    'Duplicate with larger addition',
    'Missing requested quantity',
    'Existing unspecified quantity',
    'Multiple duplicate lines',
    'Conflicting duplicate units',
    'Explicit separate line',
    'Stale confirmed update',
    'Confirmed update transport uncertainty',
  ])('keeps the %s scenario executable for review', (scenario) => {
    expect(scenarios).toMatch(new RegExp(`\\| ${scenario}\\s+\\|`));
  });
});
