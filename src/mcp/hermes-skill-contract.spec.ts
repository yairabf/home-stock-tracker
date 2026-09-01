import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Hermes grocery quantity workflow contract', () => {
  const integrationRoot = join(
    process.cwd(),
    'integrations/hermes/home-stock-tracker',
  );
  const skill = readFileSync(join(integrationRoot, 'SKILL.md'), 'utf8');
  const scenarios = readFileSync(join(integrationRoot, 'scenarios.md'), 'utf8');
  const readme = readFileSync(join(integrationRoot, 'README.md'), 'utf8');

  it('documents absolute quantity setting after confirmation', () => {
    expect(skill).toMatch(/\| `grocery_set_quantity`\s+\|/);
    expect(skill).toMatch(/\| `grocery_update`\s+\|/);
    expect(skill).toContain('`confirmation_required`');
    expect(skill).toContain('final `requestedQuantity`');
    expect(skill).toContain('`itemId`');
    expect(skill).toContain('`expectedRequestedQuantity`');
    expect(skill).toContain('`expectedUnit`');
    expect(skill).toContain('`expectedNote`');
    expect(skill).toContain('Never ask the service to perform arithmetic.');
    expect(skill).toContain('make no tool call');
    expect(skill).toContain('do not retry or');
    expect(skill).toContain('`ifPendingExists: "create_separate"`');
    expect(readme).toContain('calculate the total');
    expect(readme).toContain('`grocery_set_quantity`');
    expect(skill).not.toContain('`quantityMode`');
  });

  it('does not permit nullable persisted quantities', () => {
    expect(skill).toMatch(
      /Every persisted grocery quantity returned by the service is a\s+finite positive number\./,
    );
    expect(skill).not.toContain("existing item's `requestedQuantity` is null");
    expect(skill).not.toContain('`expectedRequestedQuantity: null`');
    expect(scenarios).not.toContain(
      '`existingItems[0].requestedQuantity: null`',
    );
    expect(scenarios).not.toContain('`expectedRequestedQuantity: null`');
  });

  it.each([
    'Omitted new-line quantity',
    'Duplicate cancellation',
    'Duplicate with final quantity',
    'Duplicate with larger addition',
    'Missing requested quantity',
    'Multiple duplicate lines',
    'Conflicting duplicate units',
    'Quantity plus note update',
    'Explicit separate line',
    'Stale quantity decision',
    'Quantity update transport uncertainty',
  ])('keeps the %s scenario executable for review', (scenario) => {
    expect(scenarios).toMatch(new RegExp(`\\| ${scenario}\\s+\\|`));
  });
});
