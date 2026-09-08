import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_OPTIONS = [
  'store-slug',
  'display-name',
  'base-url',
  'login-url',
  'locale',
  'output-root',
];
const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const portableBundleRoot = join(
  projectRoot,
  'integrations',
  'hermes',
  'online-grocery-store-integration',
);
const templatesRoot = join(portableBundleRoot, 'templates');
const adapterContractPath = join(
  portableBundleRoot,
  'references',
  'adapter-contract.md',
);
const GENERATED_FILES = [
  '.gitignore',
  'README.md',
  'SKILL.md',
  'adapter.mjs',
  'store.json',
  'data/preferences.json',
  'lib/preferences.mjs',
  'references/adapter-contract.md',
];

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const values = new Map();

  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];

    if (!option?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`Expected --option value pairs; received ${option ?? 'nothing'}`);
    }

    const name = option.slice(2);
    if (!EXPECTED_OPTIONS.includes(name)) {
      fail(`Unknown option: ${option}`);
    }
    if (values.has(name)) {
      fail(`Duplicate option: ${option}`);
    }
    values.set(name, value);
  }

  for (const name of EXPECTED_OPTIONS) {
    if (!values.has(name)) {
      fail(`Missing required option: --${name}`);
    }
  }

  return Object.fromEntries(values);
}

function validateNonEmpty(name, value) {
  if (value.trim() !== value || value.length === 0) {
    fail(`${name} must be non-empty and have no surrounding whitespace`);
  }
  return value;
}

function validateHttpsUrl(name, value) {
  if (/[\u0000-\u0020\u007f`{}]/u.test(value)) {
    fail(`${name} contains unsupported characters`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${name} must be an absolute HTTPS URL`);
  }

  if (parsed.protocol !== 'https:') {
    fail(`${name} must use HTTPS`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail(`${name} must not contain credentials, a query, or a fragment`);
  }
  return value;
}

function validateDisplayName(value) {
  const displayName = validateNonEmpty('--display-name', value);
  if (
    /[\u0000-\u001f\u007f-\u009f`]/u.test(displayName) ||
    /{{|}}/.test(displayName)
  ) {
    fail('--display-name contains unsupported template characters');
  }
  return displayName;
}

function validateLocale(value) {
  try {
    return new Intl.Locale(value).toString();
  } catch {
    fail('--locale must be a valid Intl.Locale tag');
  }
}

function pathIsInside(parent, candidate) {
  const relation = relative(parent, candidate);
  return (
    relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
  );
}

function targetExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function validateOutputRoot(value, cwd) {
  const candidate = resolve(cwd, validateNonEmpty('--output-root', value));
  let entry;
  try {
    entry = lstatSync(candidate);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      fail('--output-root must be an existing directory');
    }
    throw error;
  }
  if (!entry.isDirectory() && !entry.isSymbolicLink()) {
    fail('--output-root must be an existing directory');
  }

  const canonical = realpathSync(candidate);
  if (!lstatSync(canonical).isDirectory()) {
    fail('--output-root must be an existing directory');
  }
  return canonical;
}

export function createScaffoldPlan(argv, cwd = process.cwd()) {
  const options = parseArguments(argv);
  const storeSlug = validateNonEmpty('--store-slug', options['store-slug']);
  if (!STORE_SLUG_PATTERN.test(storeSlug)) {
    fail('--store-slug must use lowercase kebab-case');
  }

  const displayName = validateDisplayName(options['display-name']);
  const baseUrl = validateHttpsUrl('--base-url', options['base-url']);
  const loginUrl = validateHttpsUrl('--login-url', options['login-url']);
  const locale = validateLocale(options.locale);
  const outputRoot = validateOutputRoot(options['output-root'], cwd);
  const targetRoot = join(outputRoot, `${storeSlug}-shared-cart`);

  if (pathIsInside(portableBundleRoot, targetRoot)) {
    fail(
      'Target must be outside the repository-owned portable tutorial bundle',
    );
  }
  if (targetExists(targetRoot)) {
    fail(`Target already exists: ${targetRoot}`);
  }

  return {
    store: { storeSlug, displayName, baseUrl, loginUrl, locale },
    outputRoot,
    targetRoot,
  };
}

function renderTemplate(name, replacements) {
  let content = readFileSync(join(templatesRoot, name), 'utf8');
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${placeholder}}}`, value);
  }
  if (/{{[A-Z_]+}}/.test(content)) {
    fail(`Template contains an unresolved placeholder: ${name}`);
  }
  return content;
}

function renderScaffold(plan) {
  const replacements = {
    STORE_SLUG: plan.store.storeSlug,
    DISPLAY_NAME: plan.store.displayName,
    SKILL_DESCRIPTION: JSON.stringify(
      `Operate the isolated ${plan.store.displayName} cart adapter after live verification`,
    ),
    BASE_URL: plan.store.baseUrl,
    LOGIN_URL: plan.store.loginUrl,
    LOCALE: plan.store.locale,
  };
  const storeConfig = {
    schemaVersion: 1,
    ...plan.store,
    adapterCommands: ['status', 'cart', 'search', 'ensure'],
  };
  const preferences = {
    schemaVersion: 1,
    storeSlug: plan.store.storeSlug,
    preferences: [],
  };

  return [
    { path: '.gitignore', content: 'data/preferences.json\n' },
    {
      path: 'README.md',
      content: renderTemplate('README.md.template', replacements),
    },
    {
      path: 'SKILL.md',
      content: renderTemplate('SKILL.md.template', replacements),
    },
    {
      path: 'adapter.mjs',
      content: readFileSync(join(templatesRoot, 'adapter.mjs'), 'utf8'),
      mode: 0o755,
    },
    {
      path: 'store.json',
      content: `${JSON.stringify(storeConfig, null, 2)}\n`,
    },
    {
      path: 'data/preferences.json',
      content: `${JSON.stringify(preferences, null, 2)}\n`,
    },
    {
      path: 'lib/preferences.mjs',
      content: readFileSync(join(templatesRoot, 'preferences.mjs'), 'utf8'),
    },
    {
      path: 'references/adapter-contract.md',
      content: readFileSync(adapterContractPath, 'utf8'),
    },
  ];
}

function validateRenderedScaffold(files) {
  const paths = files.map((file) => file.path);
  if (
    paths.length !== GENERATED_FILES.length ||
    GENERATED_FILES.some((path) => !paths.includes(path)) ||
    new Set(paths).size !== paths.length
  ) {
    fail('Rendered scaffold does not match the required file set');
  }
  for (const file of files) {
    if (!file.content || isAbsolute(file.path) || file.path.includes('..')) {
      fail(`Invalid generated file: ${file.path}`);
    }
  }
}

export function generateScaffold(plan) {
  const files = renderScaffold(plan);
  validateRenderedScaffold(files);
  const stagingRoot = mkdtempSync(
    join(plan.outputRoot, `.${plan.store.storeSlug}-shared-cart-`),
  );

  try {
    for (const file of files) {
      const destination = join(stagingRoot, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.content, { mode: file.mode ?? 0o644 });
    }
    if (targetExists(plan.targetRoot)) {
      fail(`Target already exists: ${plan.targetRoot}`);
    }
    renameSync(stagingRoot, plan.targetRoot);
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }

  return { targetRoot: plan.targetRoot, files: GENERATED_FILES };
}

function runCli() {
  try {
    const plan = createScaffoldPlan(process.argv.slice(2));
    const result = generateScaffold(plan);
    process.stdout.write(
      `${JSON.stringify({
        state: 'ok',
        target: result.targetRoot,
        files: result.files,
      })}\n`,
    );
  } catch (error) {
    process.stderr.write(`Store skill scaffold failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
