import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

interface ScenarioCall {
  tool: string;
  argumentKeys: string[];
  enumValues: { path: string; value: string }[];
}

interface Scenario {
  id: string;
  platforms: string[];
  prerequisites: string[];
  calls: ScenarioCall[];
  resultClass: string;
  safetyInvariants: string[];
  row: [string, string, string, string];
}

describe('executable agent scenario contract', () => {
  const root = process.cwd();
  const fixture = JSON.parse(
    readFileSync(
      join(
        root,
        'integrations/shared/home-stock-tracker/scenarios/grocery-catalog.json',
      ),
      'utf8',
    ),
  ) as { schemaVersion: number; scenarios: Scenario[] };
  const scenarios = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario]),
  );

  it('validates every migrated scenario against the released MCP fixture', () => {
    const result = spawnSync('node', ['scripts/agent-scenarios.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Validated 93 executable agent scenarios.');
    expect(result.stderr).toBe('');
  });

  it('records explicit platform applicability and human-readable rows', () => {
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.scenarios).toHaveLength(93);
    expect(new Set(fixture.scenarios.map(({ id }) => id)).size).toBe(93);
    for (const scenario of fixture.scenarios) {
      expect([['hermes', 'openclaw'], ['hermes']]).toContainEqual(
        scenario.platforms,
      );
      expect(scenario.row).toHaveLength(4);
    }
  });

  it.each(['hermes', 'openclaw'])(
    'renders every executable row into the %s review table',
    (platform) => {
      const generated = readFileSync(
        join(root, 'integrations', platform, 'home-stock-tracker/scenarios.md'),
        'utf8',
      );

      expect(generated).not.toContain(
        '<!-- EXECUTABLE_GROCERY_CATALOG_SCENARIOS -->',
      );
      const expectedScenarios = fixture.scenarios.filter(({ platforms }) =>
        platforms.includes(platform),
      );
      const renderedRows = generated
        .split('\n')
        .filter(
          (line) =>
            line.startsWith('| ') &&
            !line.startsWith('| Case |') &&
            !line.startsWith('| --- |'),
        );
      expect(renderedRows).toHaveLength(expectedScenarios.length);
      for (const scenario of expectedScenarios) {
        const renderedRow = `| ${scenario.row.join(' | ')} |`;
        expect(generated.split(renderedRow)).toHaveLength(2);
      }
    },
  );

  it('keeps Hermes scheduled behavior out of the OpenClaw bundle', () => {
    const openClaw = readFileSync(
      join(root, 'integrations/openclaw/home-stock-tracker/scenarios.md'),
      'utf8',
    );
    const hermesOnly = fixture.scenarios.filter(
      ({ platforms }) => platforms.length === 1 && platforms[0] === 'hermes',
    );

    expect(hermesOnly).toHaveLength(6);
    for (const scenario of hermesOnly) {
      expect(openClaw).not.toContain(`| ${scenario.row.join(' | ')} |`);
    }
    expect(openClaw).not.toMatch(/WhatsApp|\[SILENT\]|Hermes cron/);
  });

  it('requires safe sequencing and terminal uncertainty behavior', () => {
    const completion = scenarios.get('complete-everything');
    expect(completion?.calls.map(({ tool }) => tool)).toEqual([
      'grocery_list',
      'complete_grocery_purchase',
    ]);
    expect(completion?.safetyInvariants).toEqual(
      expect.arrayContaining([
        'read-before-write',
        'unique-nonempty-purchase-items',
      ]),
    );

    const correction = scenarios.get('corrected-prediction-feedback');
    expect(correction?.prerequisites).toContain('active-prediction-id');
    expect(correction?.calls.map(({ tool }) => tool)).toEqual([
      'record_prediction_feedback',
    ]);
    expect(correction?.safetyInvariants).toContain('single-linked-correction');

    for (const scenario of fixture.scenarios.filter(
      ({ resultClass }) => resultClass === 'transport-uncertain',
    )) {
      expect(scenario.safetyInvariants).toContain('no-automatic-retry');
      expect(scenario.safetyInvariants).toContain('stop-on-uncertain-mutation');
    }
  });

  it('makes read-before-write and confirmation gates machine-checkable', () => {
    const removal = scenarios.get('remove-one-grocery-item');
    expect(removal?.calls.map(({ tool }) => tool)).toEqual([
      'grocery_list',
      'grocery_remove',
    ]);
    expect(removal?.safetyInvariants).toContain('read-before-write');

    const creation = scenarios.get('confirmed-product-creation');
    expect(creation?.prerequisites).toContain('explicit-user-confirmation');
    expect(creation?.calls.map(({ tool }) => tool)).toEqual([
      'grocery_confirm_new_product',
    ]);
    expect(creation?.safetyInvariants).toContain('no-llm-on-confirmation');

    const choice = scenarios.get('candidate-choice');
    expect(choice?.resultClass).toBe('confirmation-required');
    expect(choice?.calls).toEqual([]);
    expect(choice?.safetyInvariants).toContain('no-identity-guess');

    const standaloneAlias = scenarios.get('standalone-product-alias');
    expect(standaloneAlias?.prerequisites).toEqual(
      expect.arrayContaining([
        'explicit-user-confirmation',
        'trusted-product-id',
      ]),
    );
    expect(standaloneAlias?.calls.map(({ tool }) => tool)).toEqual([
      'product_add_alias',
    ]);
  });

  it('gates household context reads behind explicit requests', () => {
    for (const id of [
      'household-identification',
      'household-configuration-explanation',
      'missing-household-configuration',
    ]) {
      const scenario = scenarios.get(id);
      expect(scenario?.prerequisites).toContain(
        'explicit-household-context-request',
      );
      expect(scenario?.calls.map(({ tool }) => tool)).toEqual([
        'get_household_context',
      ]);
      expect(scenario?.safetyInvariants).toContain(
        'context-read-only-when-requested',
      );
      expect(scenario?.safetyInvariants).toContain('no-mutation-from-read');
    }

    expect(
      scenarios.get('inventory-estimate')?.calls.map(({ tool }) => tool),
    ).toEqual(['get_product', 'get_inventory']);
    expect(scenarios.get('inventory-estimate')?.safetyInvariants).toContain(
      'context-read-only-when-requested',
    );
  });

  it('rejects a household context scenario without an explicit request', () => {
    const script = `
      import { readFileSync } from 'node:fs';
      import { validateScenarioContract } from './scripts/agent-scenarios.mjs';
      const contract = JSON.parse(readFileSync(
        './integrations/shared/home-stock-tracker/scenarios/grocery-catalog.json',
        'utf8',
      ));
      const tools = JSON.parse(readFileSync(
        './integrations/shared/home-stock-tracker/contracts/1.3.0/tools-list.json',
        'utf8',
      ));
      const scenario = contract.scenarios.find(
        ({ id }) => id === 'household-identification',
      );
      scenario.prerequisites = [];
      validateScenarioContract(contract, tools);
    `;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { cwd: root, encoding: 'utf8' },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'must require an explicit household context request',
    );
  });

  it.each([
    ['explicit-user-confirmation', 'must require confirmation'],
    ['trusted-product-id', 'must require a trusted product ID'],
  ])(
    'rejects standalone alias scenarios without %s',
    (prerequisite, expectedError) => {
      const script = `
        import { readFileSync } from 'node:fs';
        import { validateScenarioContract } from './scripts/agent-scenarios.mjs';
        const contract = JSON.parse(readFileSync(
          './integrations/shared/home-stock-tracker/scenarios/grocery-catalog.json',
          'utf8',
        ));
        const tools = JSON.parse(readFileSync(
          './integrations/shared/home-stock-tracker/contracts/1.3.0/tools-list.json',
          'utf8',
        ));
        const scenario = contract.scenarios.find(
          ({ id }) => id === 'standalone-product-alias',
        );
        scenario.prerequisites = scenario.prerequisites.filter(
          (value) => value !== ${JSON.stringify(prerequisite)},
        );
        validateScenarioContract(contract, tools);
      `;
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', script],
        { cwd: root, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expectedError);
    },
  );

  it('encodes duplicate, update, alias, stale, cancellation, and uncertainty cases', () => {
    expect(
      scenarios.get('duplicate-with-final-quantity')?.calls[0],
    ).toMatchObject({
      tool: 'grocery_set_quantity',
      argumentKeys: [
        'itemId',
        'requestedQuantity',
        'expectedRequestedQuantity',
      ],
    });
    const update = scenarios.get('quantity-plus-note-update');
    expect(update?.calls.map(({ tool }) => tool)).toEqual(['grocery_update']);
    expect(update?.safetyInvariants).toContain('expected-old-values');
    expect(scenarios.get('confirmed-product-alias')).toMatchObject({
      calls: [{ tool: 'grocery_confirm_product_alias' }],
    });
    const stale = scenarios.get('stale-quantity-decision');
    expect(stale?.resultClass).toBe('domain-error');
    expect(stale?.safetyInvariants).toContain('no-automatic-retry');
    expect(scenarios.get('resolution-cancellation')).toMatchObject({
      resultClass: 'cancelled',
      calls: [],
    });
    const uncertain = scenarios.get('quantity-update-transport-uncertainty');
    expect(uncertain?.resultClass).toBe('transport-uncertain');
    expect(uncertain?.safetyInvariants).toContain('stop-on-uncertain-mutation');
  });

  it('records schema-checked enum values instead of prose-only policy names', () => {
    expect(
      scenarios.get('deterministic-direct-creation')?.calls[0],
    ).toMatchObject({
      tool: 'grocery_add',
      enumValues: [
        { path: 'unknownProductPolicy', value: 'create_if_missing' },
      ],
    });
    expect(scenarios.get('explicit-separate-line')?.calls[0]).toMatchObject({
      enumValues: [
        {
          path: 'groceryItem.ifPendingExists',
          value: 'create_separate',
        },
      ],
    });
  });
});
