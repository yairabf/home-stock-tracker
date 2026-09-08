import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

const REGISTRY_KEYS = ['preferences', 'schemaVersion', 'storeSlug'];
const PREFERENCE_KEYS = [
  'confirmedBy',
  'genericName',
  'productId',
  'productName',
  'quantityKind',
  'recurringTarget',
  'searchQuery',
];
const TARGET_KEYS = ['quantity', 'unit'];

function fail(message) {
  throw new Error(`Preference registry is invalid: ${message}`);
}

function assertExactKeys(value, allowed, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${context} must be an object`);
  }
  const keys = Object.keys(value).sort();
  if (
    keys.length !== allowed.length ||
    allowed.some((key, index) => keys[index] !== key)
  ) {
    fail(`${context} contains missing or unknown fields`);
  }
}

function assertText(value, field) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    fail(`${field} must be a non-empty string without surrounding whitespace`);
  }
}

export function normalizeGenericName(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('genericName must be a non-empty string');
  }
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function validateRecurringTarget(value) {
  assertExactKeys(value, TARGET_KEYS, 'recurringTarget');
  if (!Number.isFinite(value.quantity) || value.quantity <= 0) {
    fail('recurringTarget.quantity must be positive and finite');
  }
  assertText(value.unit, 'recurringTarget.unit');
}

function validatePreference(preference) {
  const requiredKeys =
    preference?.quantityKind === 'weighted'
      ? PREFERENCE_KEYS
      : PREFERENCE_KEYS.filter((key) => key !== 'recurringTarget');
  const allowedKeys = preference?.recurringTarget
    ? PREFERENCE_KEYS
    : requiredKeys;
  assertExactKeys(preference, allowedKeys, 'preference');
  for (const field of [
    'genericName',
    'searchQuery',
    'productId',
    'productName',
    'confirmedBy',
  ]) {
    assertText(preference[field], field);
  }
  if (!['packaged', 'weighted'].includes(preference.quantityKind)) {
    fail('quantityKind must be packaged or weighted');
  }
  if (preference.quantityKind === 'weighted' && !preference.recurringTarget) {
    fail('weighted preferences require recurringTarget');
  }
  if (preference.recurringTarget) {
    validateRecurringTarget(preference.recurringTarget);
  }
  return preference;
}

export function validatePreferencesRegistry(registry, expectedStoreSlug) {
  assertText(expectedStoreSlug, 'expectedStoreSlug');
  assertExactKeys(registry, REGISTRY_KEYS, 'registry');
  if (registry.schemaVersion !== 1) {
    fail('unsupported schemaVersion');
  }
  if (registry.storeSlug !== expectedStoreSlug) {
    fail('storeSlug does not match the configured store');
  }
  if (!Array.isArray(registry.preferences)) {
    fail('preferences must be an array');
  }

  const names = new Set();
  for (const preference of registry.preferences) {
    validatePreference(preference);
    const normalized = normalizeGenericName(preference.genericName);
    if (names.has(normalized)) {
      fail('genericName values must be unique after normalization');
    }
    names.add(normalized);
  }
  return registry;
}

export function loadPreferences(path, expectedStoreSlug) {
  let registry;
  try {
    registry = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const action = error instanceof SyntaxError ? 'parse' : 'read';
    fail(`could not ${action} ${basename(path)}`);
  }
  return validatePreferencesRegistry(registry, expectedStoreSlug);
}

export function findPreference(registry, genericName) {
  validatePreferencesRegistry(registry, registry?.storeSlug);
  const normalized = normalizeGenericName(genericName);
  return (
    registry.preferences.find(
      (preference) =>
        normalizeGenericName(preference.genericName) === normalized,
    ) ?? null
  );
}

export function savePreference(path, expectedStoreSlug, preference) {
  const registry = loadPreferences(path, expectedStoreSlug);
  validatePreference(preference);
  const normalized = normalizeGenericName(preference.genericName);
  const existingIndex = registry.preferences.findIndex(
    (candidate) => normalizeGenericName(candidate.genericName) === normalized,
  );
  const preferences = [...registry.preferences];
  if (existingIndex === -1) {
    preferences.push(preference);
  } else {
    preferences[existingIndex] = preference;
  }

  const nextRegistry = validatePreferencesRegistry(
    { ...registry, preferences },
    expectedStoreSlug,
  );
  const temporaryPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
  } catch {
    rmSync(temporaryPath, { force: true });
    throw new Error('Could not persist preference registry');
  }
  return preference;
}
