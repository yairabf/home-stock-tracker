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
    expect(skill).toContain('`groceryItem.ifPendingExists: "create_separate"`');
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

  it('documents safe deterministic product discovery', () => {
    expect(skill).toMatch(/\| `search_products`\s+\|/);
    expect(readme).toContain('`search_products`');
    expect(skill).toContain('Never silently select a');
    expect(skill).toContain('candidate.');
    expect(skill).toContain('list every plausible');
    expect(skill).toContain('candidate in returned order');
    expect(skill).toContain('never creates a product');
    expect(skill).toContain('advice only');
    expect(scenarios).toContain('| Exact product search');
    expect(scenarios).toContain('| One nearby product candidate');
    expect(scenarios).toContain('| Multiple product candidates');
    expect(scenarios).toContain('| Prediction-disabled discovery');
    expect(scenarios).toContain('| Search is read-only');
  });

  it('documents policy-aware grocery addition without guessed facts', () => {
    expect(skill).toContain('`propose_if_missing`');
    expect(skill).toContain('`create_if_missing`');
    expect(skill).toContain('`product_resolution_required`');
    expect(skill).toContain('nested `groceryItem`');
    expect(skill).toContain('Proposal advice is non-authoritative');
    expect(skill).toContain('do not guess them to force creation');
    expect(readme).toContain('non-authoritative');
    expect(scenarios).toContain('| Unknown product proposal');
    expect(scenarios).toContain('| Proposal is non-authoritative');
    expect(scenarios).toContain('| Candidate choice');
    expect(scenarios).toContain('| Resolution cancellation');
    expect(scenarios).toContain('| Deterministic direct creation');
    expect(scenarios).toContain('groceryItem: { requestedQuantity: 2');
    expect(scenarios).not.toContain(
      'grocery_add({ productName: "milk", requestedQuantity:',
    );
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
