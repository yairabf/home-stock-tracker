import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReleaseContract } from './agent-release-contract.mjs';

const ROOT_KEYS = ['schemaVersion', 'scenarios'];
const SCENARIO_KEYS = [
  'id',
  'platforms',
  'prerequisites',
  'calls',
  'resultClass',
  'safetyInvariants',
  'row',
];
const CALL_KEYS = ['tool', 'argumentKeys', 'enumValues'];
const ENUM_KEYS = ['path', 'value'];
const PLATFORMS = ['hermes', 'openclaw'];
const RESULT_CLASSES = [
  'success',
  'empty',
  'confirmation-required',
  'resolution-required',
  'cancelled',
  'domain-error',
  'transport-uncertain',
  'no-action',
  'blocked',
  'delivered',
  'silent',
];
const PREREQUISITES = [
  'complete-product-facts',
  'active-prediction-id',
  'explicit-household-context-request',
  'explicit-actual-measurement',
  'exact-catalog-match',
  'existing-grocery-line',
  'explicit-user-confirmation',
  'fresh-grocery-snapshot',
  'hermes-runtime-configured',
  'prior-history-page',
  'prior-mutation-result',
  'product-resolution-result',
  'scheduled-trigger',
  'trusted-grocery-item-id',
  'trusted-product-id',
  'user-selected-product',
];
const INVARIANTS = [
  'atomic-catalog-and-grocery-write',
  'actual-measurements-user-supplied',
  'all-or-nothing-batch',
  'at-most-one-delivery',
  'context-read-only-when-requested',
  'expected-old-values',
  'exact-silent-sentinel',
  'explicit-separate-line-only',
  'history-is-not-current-stock',
  'no-automatic-retry',
  'no-catalog-confirmation-repeat',
  'no-cross-run-deduplication',
  'no-event-type-guess',
  'no-fact-invention',
  'no-identity-guess',
  'no-inventory-count-invention',
  'no-llm-on-confirmation',
  'no-mutation-before-confirmation',
  'no-mutation-from-read',
  'no-mutation-on-ambiguity',
  'no-mutation-on-cancellation',
  'no-omitted-item-completion',
  'no-partial-measurements',
  'no-prediction-id-guess',
  'no-requested-measurement-copy',
  'no-service-side-arithmetic',
  'no-silent-on-failure',
  'no-success-claim-on-error',
  'no-unit-conversion',
  'no-write-from-future-intent',
  'one-consolidated-message',
  'one-recommendation-read',
  'operator-fixes-configuration',
  'preserve-item-boundaries',
  'preserve-filters-and-pagination',
  'preserve-returned-order',
  'preserve-scheduled-facts',
  'read-before-write',
  'search-is-read-only',
  'single-linked-correction',
  'stop-on-uncertain-mutation',
  'successful-empty-only-silent',
  'trusted-ids-only',
  'unique-nonempty-purchase-items',
  'user-selects-product-identity',
];
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARGUMENT_PATH_PATTERN =
  /^[a-z][a-zA-Z0-9]*(?:\[\])?(?:\.[a-z][a-zA-Z0-9]*(?:\[\])?)*$/;

function assertObject(value, path) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${path} must be an object`);
  }
}

function assertExactKeys(value, keys, path) {
  assertObject(value, path);
  const actual = Object.keys(value);
  const missing = keys.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !keys.includes(key));
  if (missing.length > 0) {
    throw new Error(`${path} is missing field: ${missing.join(', ')}`);
  }
  if (extra.length > 0) {
    throw new Error(`${path} has unsupported field: ${extra.join(', ')}`);
  }
}

function assertUniqueStrings(values, allowed, path, allowEmpty = false) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new Error(
      `${path} must be ${allowEmpty ? 'an' : 'a non-empty'} array`,
    );
  }
  const seen = new Set();
  values.forEach((value, index) => {
    if (typeof value !== 'string' || (allowed && !allowed.includes(value))) {
      throw new Error(`${path}[${index}] is not an allowed value`);
    }
    if (seen.has(value)) {
      throw new Error(`${path} contains duplicate value: ${value}`);
    }
    seen.add(value);
  });
}

function schemaAtPath(schema, path) {
  let current = schema;
  for (const segment of path.split('.')) {
    const arrayItem = segment.endsWith('[]');
    const property = arrayItem ? segment.slice(0, -2) : segment;
    current = current?.properties?.[property];
    if (arrayItem) current = current?.items;
    if (!current) return undefined;
  }
  return current;
}

function validateCall(call, path, toolsByName) {
  assertExactKeys(call, CALL_KEYS, path);
  const tool = toolsByName.get(call.tool);
  if (!tool)
    throw new Error(`${path}.tool references unknown tool: ${call.tool}`);
  assertUniqueStrings(call.argumentKeys, null, `${path}.argumentKeys`, true);
  call.argumentKeys.forEach((argumentPath, index) => {
    if (!ARGUMENT_PATH_PATTERN.test(argumentPath)) {
      throw new Error(
        `${path}.argumentKeys[${index}] is not a valid argument path`,
      );
    }
    if (!schemaAtPath(tool.inputSchema, argumentPath)) {
      throw new Error(
        `${path}.argumentKeys[${index}] is absent from ${call.tool} input schema`,
      );
    }
  });
  if (!Array.isArray(call.enumValues)) {
    throw new Error(`${path}.enumValues must be an array`);
  }
  call.enumValues.forEach((entry, index) => {
    const enumPath = `${path}.enumValues[${index}]`;
    assertExactKeys(entry, ENUM_KEYS, enumPath);
    if (!call.argumentKeys.includes(entry.path)) {
      throw new Error(`${enumPath}.path must also appear in argumentKeys`);
    }
    const schema = schemaAtPath(tool.inputSchema, entry.path);
    if (!schema?.enum?.includes(entry.value)) {
      throw new Error(
        `${enumPath}.value is absent from ${call.tool} input schema enum`,
      );
    }
  });
}

function validateCallOrder(scenario, path) {
  const calls = scenario.calls.map(({ tool }) => tool);
  const precedes = (read, write) =>
    calls.includes(read) && calls.indexOf(read) < calls.indexOf(write);
  const hasPrerequisite = (prerequisite) =>
    scenario.prerequisites.includes(prerequisite);

  if (
    calls.includes('grocery_remove') &&
    !precedes('grocery_list', 'grocery_remove') &&
    !hasPrerequisite('trusted-grocery-item-id')
  ) {
    throw new Error(`${path} must read groceries before removal`);
  }
  if (
    calls.includes('complete_grocery_purchase') &&
    !precedes('grocery_list', 'complete_grocery_purchase') &&
    !hasPrerequisite('fresh-grocery-snapshot')
  ) {
    throw new Error(`${path} must read groceries before purchase completion`);
  }
  for (const write of [
    'record_purchase',
    'record_purchases',
    'update_inventory',
    'record_stock_signal',
  ]) {
    if (
      calls.includes(write) &&
      !precedes('get_product', write) &&
      !hasPrerequisite('trusted-product-id')
    ) {
      throw new Error(`${path} must resolve a product before ${write}`);
    }
  }
  if (
    calls.includes('grocery_add') &&
    calls.includes('get_low_stock_predictions') &&
    !hasPrerequisite('explicit-user-confirmation')
  ) {
    throw new Error(
      `${path} must require confirmation before adding a suggestion`,
    );
  }
  if (
    scenario.safetyInvariants.includes('one-recommendation-read') &&
    calls.filter((tool) => tool === 'get_low_stock_predictions').length !== 1
  ) {
    throw new Error(`${path} must contain exactly one recommendation read`);
  }
  if (
    calls.includes('record_purchases') &&
    !scenario.safetyInvariants.includes('all-or-nothing-batch')
  ) {
    throw new Error(`${path} must preserve all-or-nothing batch behavior`);
  }
  if (
    calls.includes('record_prediction_feedback') &&
    !hasPrerequisite('active-prediction-id')
  ) {
    throw new Error(`${path} must require an active prediction ID`);
  }
  if (
    calls.includes('get_household_context') &&
    !hasPrerequisite('explicit-household-context-request')
  ) {
    throw new Error(
      `${path} must require an explicit household context request`,
    );
  }
  for (const confirmationTool of [
    'grocery_confirm_new_product',
    'grocery_confirm_product_alias',
    'product_add_alias',
  ]) {
    if (
      calls.includes(confirmationTool) &&
      !hasPrerequisite('explicit-user-confirmation')
    ) {
      throw new Error(
        `${path} must require confirmation before ${confirmationTool}`,
      );
    }
  }
  if (
    calls.includes('product_add_alias') &&
    !hasPrerequisite('trusted-product-id')
  ) {
    throw new Error(
      `${path} must require a trusted product ID before product_add_alias`,
    );
  }
}

export function validateScenarioContract(contract, toolsFixture) {
  assertExactKeys(contract, ROOT_KEYS, 'scenarioContract');
  if (contract.schemaVersion !== 1) {
    throw new Error('scenarioContract.schemaVersion must be 1');
  }
  if (!Array.isArray(toolsFixture?.tools)) {
    throw new Error('tools fixture must contain a tools array');
  }
  if (!Array.isArray(contract.scenarios) || contract.scenarios.length === 0) {
    throw new Error('scenarioContract.scenarios must be a non-empty array');
  }

  const toolsByName = new Map(
    toolsFixture.tools.map((tool) => [tool.name, tool]),
  );
  const ids = new Set();
  const titles = new Set();
  contract.scenarios.forEach((scenario, index) => {
    const path = `scenarioContract.scenarios[${index}]`;
    assertExactKeys(scenario, SCENARIO_KEYS, path);
    if (
      typeof scenario.id !== 'string' ||
      !IDENTIFIER_PATTERN.test(scenario.id)
    ) {
      throw new Error(`${path}.id must be a kebab-case identifier`);
    }
    if (ids.has(scenario.id))
      throw new Error(`${path}.id is duplicated: ${scenario.id}`);
    ids.add(scenario.id);
    assertUniqueStrings(scenario.platforms, PLATFORMS, `${path}.platforms`);
    assertUniqueStrings(
      scenario.prerequisites,
      PREREQUISITES,
      `${path}.prerequisites`,
      true,
    );
    if (!Array.isArray(scenario.calls))
      throw new Error(`${path}.calls must be an array`);
    scenario.calls.forEach((call, callIndex) =>
      validateCall(call, `${path}.calls[${callIndex}]`, toolsByName),
    );
    validateCallOrder(scenario, path);
    if (!RESULT_CLASSES.includes(scenario.resultClass)) {
      throw new Error(`${path}.resultClass is not an allowed value`);
    }
    assertUniqueStrings(
      scenario.safetyInvariants,
      INVARIANTS,
      `${path}.safetyInvariants`,
    );
    if (
      !Array.isArray(scenario.row) ||
      scenario.row.length !== 4 ||
      scenario.row.some((cell) => typeof cell !== 'string' || cell.length === 0)
    ) {
      throw new Error(`${path}.row must contain four non-empty Markdown cells`);
    }
    if (titles.has(scenario.row[0]))
      throw new Error(`${path}.row title is duplicated`);
    titles.add(scenario.row[0]);
    if (scenario.resultClass === 'transport-uncertain') {
      if (
        !scenario.safetyInvariants.includes('no-automatic-retry') ||
        !scenario.safetyInvariants.includes('stop-on-uncertain-mutation')
      ) {
        throw new Error(
          `${path} transport uncertainty must stop without automatic retry`,
        );
      }
    }
    if (
      scenario.platforms.length === 1 &&
      scenario.platforms[0] === 'hermes' &&
      scenario.calls.some(({ tool }) =>
        [
          'grocery_add',
          'grocery_confirm_new_product',
          'grocery_confirm_product_alias',
          'grocery_remove',
          'grocery_set_quantity',
          'grocery_update',
          'complete_grocery_purchase',
          'product_add_alias',
          'record_purchase',
          'record_purchases',
          'record_prediction_feedback',
          'record_stock_signal',
          'update_inventory',
        ].includes(tool),
      )
    ) {
      throw new Error(`${path} scheduled Hermes scenario cannot mutate`);
    }
  });
  return contract;
}

export function loadScenarioContract(projectRoot) {
  const sharedRoot = join(
    projectRoot,
    'integrations',
    'shared',
    'home-stock-tracker',
  );
  const releaseContract = loadReleaseContract(projectRoot);
  const scenarioPath = join(sharedRoot, 'scenarios', 'grocery-catalog.json');
  const toolsPath = join(sharedRoot, releaseContract.mcp.toolsFixture);
  const contract = JSON.parse(readFileSync(scenarioPath, 'utf8'));
  const toolsFixture = JSON.parse(readFileSync(toolsPath, 'utf8'));
  return validateScenarioContract(contract, toolsFixture);
}

export function renderScenarioTable(contract, platform, platformOnly = false) {
  const header = [
    '| Case | User request or condition | Expected action | Expected outcome |',
    '| --- | --- | --- | --- |',
  ];
  const rows = contract.scenarios
    .filter(({ platforms }) =>
      platformOnly
        ? platforms.length === 1 && platforms[0] === platform
        : platforms.length === PLATFORMS.length,
    )
    .map(({ row }) => `| ${row.join(' | ')} |`);
  return [...header, ...rows].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const contract = loadScenarioContract(root);
    console.log(
      `Validated ${contract.scenarios.length} executable agent scenarios.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
