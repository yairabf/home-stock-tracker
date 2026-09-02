import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface AgentBundle {
  platform: 'hermes' | 'openclaw';
  skill: string;
  scenarios: string;
  readme: string;
}

describe('agent inventory skill contract', () => {
  const projectRoot = process.cwd();
  const platforms: AgentBundle['platform'][] = ['hermes', 'openclaw'];
  const bundles = platforms.map((platform): AgentBundle => {
    const root = join(
      projectRoot,
      'integrations',
      platform,
      'home-stock-tracker',
    );

    return {
      platform,
      skill: readFileSync(join(root, 'SKILL.md'), 'utf8'),
      scenarios: readFileSync(join(root, 'scenarios.md'), 'utf8'),
      readme: readFileSync(join(root, 'README.md'), 'utf8'),
    };
  });

  function sharedFragments(fileName: string, marker: string): string[] {
    return readFileSync(
      join(projectRoot, 'integrations/shared/home-stock-tracker', fileName),
      'utf8',
    )
      .split(marker)
      .map((fragment) => fragment.trim())
      .filter(Boolean);
  }

  it.each(bundles)(
    '$platform contains every canonical shared section',
    (bundle) => {
      for (const fragment of sharedFragments(
        'workflow.md',
        '<!-- PLATFORM_WORKFLOW -->',
      )) {
        expect(bundle.skill).toContain(fragment);
      }
      const sharedScenarios = readFileSync(
        join(
          projectRoot,
          'integrations/shared/home-stock-tracker/scenarios.md',
        ),
        'utf8',
      );
      const remainingSharedScenarios = sharedScenarios
        .split('<!-- EXECUTABLE_GROCERY_CATALOG_SCENARIOS -->')[1]
        .split('<!-- PLATFORM_SCENARIOS -->')[0]
        .trim();
      expect(bundle.scenarios).toContain(remainingSharedScenarios);
    },
  );

  it.each(bundles)(
    '$platform documents absolute quantity setting after confirmation',
    ({ skill, readme }) => {
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
      expect(skill).toContain(
        '`groceryItem.ifPendingExists: "create_separate"`',
      );
      expect(readme).toContain('calculate the total');
      expect(readme).toContain('`grocery_set_quantity`');
      expect(skill).not.toContain('`quantityMode`');
    },
  );

  it.each(bundles)(
    '$platform does not permit nullable persisted quantities',
    ({ skill, scenarios }) => {
      expect(skill).toMatch(
        /Every persisted grocery quantity returned by the service is a\s+finite positive number\./,
      );
      expect(skill).not.toContain(
        "existing item's `requestedQuantity` is null",
      );
      expect(skill).not.toContain('`expectedRequestedQuantity: null`');
      expect(scenarios).not.toContain(
        '`existingItems[0].requestedQuantity: null`',
      );
      expect(scenarios).not.toContain('`expectedRequestedQuantity: null`');
    },
  );

  it.each(bundles)(
    '$platform documents safe deterministic product discovery',
    ({ skill, scenarios, readme }) => {
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
    },
  );

  it.each(bundles)(
    '$platform documents safe inventory-event history reads',
    ({ skill, scenarios, readme }) => {
      expect(skill).toContain('version: 1.11.0');
      expect(skill).toMatch(/\| `list_inventory_events`\s+\|/);
      expect(readme).toContain('`list_inventory_events`');
      expect(skill).toContain('Results are newest first.');
      expect(skill).toContain('MCP history intentionally omits stored');
      expect(skill).toContain('not proof of the exact current');
      expect(skill).toContain('History reads never authorize a mutation.');
      expect(scenarios).toContain('| Named product history');
      expect(scenarios).toContain('| Filtered purchase history');
      expect(scenarios).toContain('| Empty inventory history');
      expect(scenarios).toContain('| Inventory history pagination');
      expect(scenarios).toContain('| Correction history review');
    },
  );

  it.each(bundles)(
    '$platform documents policy-aware grocery addition without guessed facts',
    ({ skill, scenarios, readme }) => {
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
    },
  );

  it.each(bundles)(
    '$platform documents explicit confirmed catalog decisions',
    ({ skill, scenarios, readme }) => {
      expect(skill).toMatch(/\| `grocery_confirm_new_product`\s+\|/);
      expect(skill).toMatch(/\| `grocery_confirm_product_alias`\s+\|/);
      expect(skill).toContain('Do not pass proposal state');
      expect(skill).toMatch(/Do not repeat the\s+catalog confirmation/);
      expect(skill).toContain('`PRODUCT_NAME_CONFLICT`');
      expect(skill).toContain('`PRODUCT_NOT_FOUND`');
      expect(readme).toContain('`grocery_confirm_new_product`');
      expect(readme).toContain('`grocery_confirm_product_alias`');
      expect(scenarios).toContain('| Confirmed product creation');
      expect(scenarios).toContain('| Confirmed product alias');
      expect(scenarios).toContain('| Confirmed alias with quantity ambiguity');
      expect(scenarios).toContain('| Confirmed relative quantity');
      expect(scenarios).toContain('| Stale confirmed catalog decision');
    },
  );

  it.each(bundles)(
    '$platform requires a confirmed exact target for standalone aliases',
    ({ skill, scenarios, readme }) => {
      expect(skill).toMatch(/\| `product_add_alias`\s+\|/);
      expect(skill).toContain(
        '`product_add_alias` always requires explicit confirmation',
      );
      expect(skill).toContain('one exact trusted product ID');
      expect(skill).toContain('retry automatically');
      expect(readme).toContain('`product_add_alias`');
      expect(scenarios).toContain('| Standalone product alias');
      expect(scenarios).toContain('| Standalone alias with ambiguous target');
      expect(scenarios).toContain('| Standalone alias ownership conflict');
      expect(scenarios).toContain('| Standalone alias target was deleted');
      expect(scenarios).toContain('| Standalone alias transport uncertainty');
    },
  );

  it.each(bundles)(
    '$platform documents safe prediction feedback workflows',
    ({ skill, scenarios, readme }) => {
      expect(skill).toContain('version: 1.11.0');
      expect(skill).toMatch(/\| `record_prediction_feedback`\s+\|/);
      expect(readme).toContain('`record_prediction_feedback`');
      expect(skill).toContain('active interaction');
      expect(skill).toContain('non-null');
      expect(skill).toContain('Never guess, transform, or reuse an');
      expect(skill).toContain(
        '`likely_available`, `probably_low`, or `probably_out`',
      );
      expect(skill).toContain('Do not also call `record_stock_signal`');
      expect(skill).toContain('`Prediction feedback was already recorded`');
      expect(scenarios).toContain('| General stock correction');
      expect(scenarios).toContain('| Accepted prediction feedback');
      expect(scenarios).toContain('| Rejected prediction feedback');
      expect(scenarios).toContain('| Corrected prediction feedback');
      expect(scenarios).toContain('| Ambiguous prediction feedback');
      expect(scenarios).toContain('| Null prediction ID');
      expect(scenarios).toContain('| Repeated prediction feedback');
      expect(scenarios).toContain(
        '| Prediction feedback transport uncertainty',
      );
    },
  );

  it.each(bundles)(
    '$platform documents actual purchase completion without invention',
    ({ skill, scenarios, readme }) => {
      expect(skill).toContain('version: 1.11.0');
      expect(skill).toMatch(/\| `complete_grocery_purchase`\s+\|/);
      expect(skill).toContain('preferred inclusive `items` array');
      expect(skill).toContain('`actualQuantity`');
      expect(skill).toContain('`actualUnit`');
      expect(skill).toMatch(/Never\s+copy `requestedQuantity`/);
      expect(skill).toContain('Never convert units.');
      expect(skill).toContain('transitional older');
      expect(skill).toMatch(
        /do not\s+retry or claim that any item was completed/,
      );
      expect(readme).toContain(
        '`complete_grocery_purchase({ items: [{ groceryItemId: ... }] })`',
      );
      expect(readme).toContain('requested values');
      expect(scenarios).toContain('| Complete with actual measurement');
      expect(scenarios).toContain('| Complete without actual measurement');
      expect(scenarios).toContain('| Duplicate product measured consistently');
      expect(scenarios).toContain('| Duplicate product measurement ambiguity');
      expect(scenarios).not.toContain(
        'complete_grocery_purchase({ groceryItemIds:',
      );
    },
  );

  it.each(
    bundles.flatMap((bundle) => [
      { bundle, scenario: 'Omitted new-line quantity' },
      { bundle, scenario: 'Duplicate cancellation' },
      { bundle, scenario: 'Duplicate with final quantity' },
      { bundle, scenario: 'Duplicate with larger addition' },
      { bundle, scenario: 'Missing requested quantity' },
      { bundle, scenario: 'Multiple duplicate lines' },
      { bundle, scenario: 'Conflicting duplicate units' },
      { bundle, scenario: 'Quantity plus note update' },
      { bundle, scenario: 'Explicit separate line' },
      { bundle, scenario: 'Stale quantity decision' },
      { bundle, scenario: 'Quantity update transport uncertainty' },
    ]),
  )(
    '$bundle.platform keeps the $scenario scenario executable for review',
    ({ bundle, scenario }) => {
      expect(bundle.scenarios).toMatch(new RegExp(`\\| ${scenario}\\s+\\|`));
    },
  );

  it('keeps scheduled delivery semantics in the Hermes adapter only', () => {
    const hermes = bundles.find(({ platform }) => platform === 'hermes');
    const openClaw = bundles.find(({ platform }) => platform === 'openclaw');

    expect(hermes?.skill).toContain('[SILENT]');
    expect(hermes?.scenarios).toContain('Hermes cron history');

    const openClawArtifacts = [
      openClaw?.skill,
      openClaw?.scenarios,
      openClaw?.readme,
    ].join('\n');
    expect(openClawArtifacts).not.toMatch(
      /~\/.hermes|hermes cron|\[SILENT\]|WhatsApp home channel|integrations\/hermes/i,
    );
  });

  it('routes each documented install to its dedicated bundle', () => {
    const integrationGuide = readFileSync(
      join(projectRoot, 'docs/agent-integrations.md'),
      'utf8',
    );
    const openClawSection = integrationGuide
      .split('## OpenClaw')[1]
      .split('## Other MCP clients')[0];

    expect(integrationGuide).toContain(
      'integrations/hermes/home-stock-tracker',
    );
    expect(openClawSection).toContain(
      'integrations/openclaw/home-stock-tracker',
    );
    expect(openClawSection).not.toContain('integrations/hermes');
  });
});
