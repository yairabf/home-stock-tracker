import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Hermes grocery duplicate workflow contract', () => {
  const integrationRoot = join(
    process.cwd(),
    'integrations/hermes/home-stock-tracker',
  );
  const skill = readFileSync(join(integrationRoot, 'SKILL.md'), 'utf8');
  const scenarios = readFileSync(
    join(integrationRoot, 'scenarios.md'),
    'utf8',
  );
  const readme = readFileSync(join(integrationRoot, 'README.md'), 'utf8');

  it('documents the runtime tools and confirmation result', () => {
    expect(skill).toContain('| `grocery_update` |');
    expect(skill).toContain('`confirmation_required`');
    expect(skill).toContain('`expectedRequestedQuantity`');
    expect(skill).toContain('`expectedUnit`');
    expect(skill).toContain('`ifPendingExists: "create_separate"`');
    expect(readme).toContain('`grocery_add`, `grocery_update`');
  });

  it.each([
    'Duplicate cancellation',
    'Confirmed duplicate increment',
    'Missing requested quantity',
    'Existing unspecified quantity',
    'Multiple duplicate lines',
    'Conflicting duplicate units',
    'Explicit separate line',
    'Stale confirmed update',
    'Confirmed update transport uncertainty',
  ])('keeps the %s scenario executable for review', (scenario) => {
    expect(scenarios).toContain(`| ${scenario} |`);
  });
});
