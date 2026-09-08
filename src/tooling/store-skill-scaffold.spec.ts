import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface ScaffoldPlan {
  store: {
    storeSlug: string;
    displayName: string;
    baseUrl: string;
    loginUrl: string;
    locale: string;
  };
  outputRoot: string;
  targetRoot: string;
}

describe('store skill scaffold planning', () => {
  const projectRoot = process.cwd();
  const generatorPath = join(projectRoot, 'scripts/generate-store-skill.mjs');
  const generatorUrl = pathToFileURL(
    join(projectRoot, 'scripts/generate-store-skill.mjs'),
  ).href;

  function createPlan(args: string[]): ScaffoldPlan {
    const source = `
      import { createScaffoldPlan } from ${JSON.stringify(generatorUrl)};
      try {
        process.stdout.write(JSON.stringify(createScaffoldPlan(JSON.parse(process.env.SCAFFOLD_TEST_ARGS))));
      } catch (error) {
        process.stderr.write(error.message);
        process.exitCode = 1;
      }
    `;
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', source],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: { ...process.env, SCAFFOLD_TEST_ARGS: JSON.stringify(args) },
      },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr);
    }
    return JSON.parse(result.stdout) as ScaffoldPlan;
  }

  function validArguments(outputRoot: string): string[] {
    return [
      '--store-slug',
      'example-store',
      '--display-name',
      'Example Store',
      '--base-url',
      'https://store.example',
      '--login-url',
      'https://store.example/login',
      '--locale',
      'en-US',
      '--output-root',
      outputRoot,
    ];
  }

  function runGenerator(outputRoot: string) {
    return spawnSync(
      process.execPath,
      [generatorPath, ...validArguments(outputRoot)],
      { cwd: projectRoot, encoding: 'utf8' },
    );
  }

  it('creates a deterministic plan for valid placeholder input', () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'store-plan-'));
    const canonicalOutputRoot = realpathSync(outputRoot);

    const plan = createPlan(validArguments(outputRoot));

    expect(plan).toEqual({
      store: {
        storeSlug: 'example-store',
        displayName: 'Example Store',
        baseUrl: 'https://store.example',
        loginUrl: 'https://store.example/login',
        locale: 'en-US',
      },
      outputRoot: canonicalOutputRoot,
      targetRoot: join(canonicalOutputRoot, 'example-store-shared-cart'),
    });
  });

  it.each([
    ['missing option', (args: string[]) => args.slice(0, -2)],
    ['unknown option', (args: string[]) => [...args, '--force', 'true']],
    ['duplicate option', (args: string[]) => [...args, '--locale', 'he-IL']],
    ['malformed slug', (args: string[]) => args.with(1, '../Example Store')],
    ['empty display name', (args: string[]) => args.with(3, '')],
    [
      'frontmatter-injecting display name',
      (args: string[]) => args.with(3, 'Example\nname: injected'),
    ],
    ['non-HTTPS URL', (args: string[]) => args.with(5, 'http://store.example')],
    [
      'credential-bearing URL',
      (args: string[]) => args.with(5, 'https://user:pass@store.example'),
    ],
    [
      'URL with query',
      (args: string[]) => args.with(7, 'https://store.example/login?next=cart'),
    ],
    ['invalid locale', (args: string[]) => args.with(9, 'not_a_locale')],
    [
      'missing output root',
      (args: string[]) => args.with(11, join(args[11], 'missing')),
    ],
  ])('rejects %s', (_name, mutate) => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'store-invalid-'));

    expect(() => createPlan(mutate(validArguments(outputRoot)))).toThrow();
  });

  it('rejects an existing target without changing its sentinel', () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'store-existing-'));
    const targetRoot = join(outputRoot, 'example-store-shared-cart');
    const sentinel = join(targetRoot, 'keep.txt');
    mkdirSync(targetRoot);
    writeFileSync(sentinel, 'keep');

    expect(() => createPlan(validArguments(outputRoot))).toThrow(
      'Target already exists',
    );
    expect(readFileSync(sentinel, 'utf8')).toBe('keep');
  });

  it('rejects targets inside the portable tutorial bundle', () => {
    const outputRoot = join(
      projectRoot,
      'integrations/hermes/online-grocery-store-integration',
    );

    expect(() => createPlan(validArguments(outputRoot))).toThrow(
      'outside the repository-owned portable tutorial bundle',
    );
  });

  describe('generated starter bundle', () => {
    const expectedFiles = [
      '.gitignore',
      'README.md',
      'SKILL.md',
      'adapter.mjs',
      'store.json',
      'data/preferences.json',
      'lib/preferences.mjs',
      'references/adapter-contract.md',
    ];

    function generatedContents(root: string): Record<string, string> {
      const target = join(realpathSync(root), 'example-store-shared-cart');
      return Object.fromEntries(
        expectedFiles.map((path) => [
          path,
          readFileSync(join(target, path), 'utf8'),
        ]),
      );
    }

    it('generates the complete deterministic file set', () => {
      const firstRoot = mkdtempSync(join(tmpdir(), 'store-generate-a-'));
      const secondRoot = mkdtempSync(join(tmpdir(), 'store-generate-b-'));

      const first = runGenerator(firstRoot);
      const second = runGenerator(secondRoot);

      expect(first.status).toBe(0);
      expect(second.status).toBe(0);
      expect(JSON.parse(first.stdout)).toMatchObject({
        state: 'ok',
        files: expectedFiles,
      });
      expect(generatedContents(firstRoot)).toEqual(
        generatedContents(secondRoot),
      );
    });

    it.each([
      ['status', []],
      ['cart', []],
      ['search', ['--query', 'milk']],
      [
        'ensure',
        ['--query', 'milk', '--product-id', 'exact-id', '--quantity', '2'],
      ],
    ])('keeps the generated %s command inert', (command, args) => {
      const outputRoot = mkdtempSync(join(tmpdir(), 'store-adapter-'));
      expect(runGenerator(outputRoot).status).toBe(0);
      const adapter = join(
        realpathSync(outputRoot),
        'example-store-shared-cart/adapter.mjs',
      );

      const result = spawnSync(process.execPath, [adapter, command, ...args], {
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        state: 'not_implemented',
        command,
        message: 'Store-specific adapter behavior has not been implemented.',
      });
    });

    it.each([
      ['unknown command', ['checkout']],
      ['missing search query', ['search']],
      ['unknown option', ['cart', '--force', 'true']],
      ['duplicate option', ['search', '--query', 'milk', '--query', 'eggs']],
      [
        'invalid quantity',
        [
          'ensure',
          '--query',
          'milk',
          '--product-id',
          'id',
          '--quantity',
          'NaN',
        ],
      ],
    ])('fails closed for %s', (_name, args) => {
      const outputRoot = mkdtempSync(join(tmpdir(), 'store-adapter-error-'));
      expect(runGenerator(outputRoot).status).toBe(0);
      const adapter = join(
        realpathSync(outputRoot),
        'example-store-shared-cart/adapter.mjs',
      );

      const result = spawnSync(process.execPath, [adapter, ...args], {
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const output = JSON.parse(result.stdout);
      expect(output.state).toBe('error');
      if (args[0] === 'checkout') {
        expect(output.command).toBe('unknown');
        expect(result.stdout).not.toContain('checkout');
      }
    });

    it('preserves the feature 34a safety boundary in generated text', () => {
      const outputRoot = mkdtempSync(join(tmpdir(), 'store-safety-'));
      expect(runGenerator(outputRoot).status).toBe(0);
      const contents = generatedContents(outputRoot);
      const guidance = `${contents['README.md']}\n${contents['SKILL.md']}`;

      expect(guidance).toContain('not a working store adapter');
      expect(guidance).toContain('fresh live search');
      expect(guidance).toContain('is not a purchase');
      expect(guidance).toContain('Never check out');
      expect(contents['SKILL.md']).toContain(
        'description: "Operate the isolated Example Store cart adapter after live verification"',
      );
      expect(contents['adapter.mjs']).not.toMatch(
        /node:https|node:http|selenium|playwright|webdriver|fetch\(/i,
      );
    });

    it('emits only allowlisted generated JSON and inert executable content', () => {
      const outputRoot = mkdtempSync(join(tmpdir(), 'store-content-'));
      expect(runGenerator(outputRoot).status).toBe(0);
      const contents = generatedContents(outputRoot);
      const store = JSON.parse(contents['store.json']);
      const preferences = JSON.parse(contents['data/preferences.json']);

      expect(Object.keys(store).sort()).toEqual([
        'adapterCommands',
        'baseUrl',
        'displayName',
        'locale',
        'loginUrl',
        'schemaVersion',
        'storeSlug',
      ]);
      expect(Object.keys(preferences).sort()).toEqual([
        'preferences',
        'schemaVersion',
        'storeSlug',
      ]);
      expect(
        `${contents['adapter.mjs']}\n${contents['lib/preferences.mjs']}`,
      ).not.toMatch(
        /https?:\/\/|selenium|playwright|webdriver|password\s*=|token\s*=|cookie\s*=|session\s*=/i,
      );
    });

    it('publishes the scaffold command and incomplete-adapter boundary', () => {
      const publicGuide = readFileSync(
        join(projectRoot, 'docs/agent-integrations.md'),
        'utf8',
      );
      const bundleReadme = readFileSync(
        join(
          projectRoot,
          'integrations/hermes/online-grocery-store-integration/README.md',
        ),
        'utf8',
      );
      const tutorial = readFileSync(
        join(
          projectRoot,
          'integrations/hermes/online-grocery-store-integration/references/build-tutorial.md',
        ),
        'utf8',
      );

      for (const document of [publicGuide, bundleReadme, tutorial]) {
        expect(document).toContain('npm run store-skill:scaffold --');
        expect(document).toContain('not_implemented');
      }
    });

    it('leaves an existing target byte-identical', () => {
      const outputRoot = mkdtempSync(join(tmpdir(), 'store-overwrite-'));
      const target = join(outputRoot, 'example-store-shared-cart');
      writeFileSync(target, 'sentinel');

      const result = runGenerator(outputRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Target already exists');
      expect(readFileSync(target, 'utf8')).toBe('sentinel');
      expect(readdirSync(outputRoot)).toEqual(['example-store-shared-cart']);
    });

    describe('generated preference helper', () => {
      function runPreferenceCode(outputRoot: string, source: string) {
        const target = join(
          realpathSync(outputRoot),
          'example-store-shared-cart',
        );
        return spawnSync(
          process.execPath,
          ['--input-type=module', '--eval', source],
          {
            cwd: target,
            encoding: 'utf8',
            env: {
              ...process.env,
              PREFERENCE_HELPER: pathToFileURL(
                join(target, 'lib/preferences.mjs'),
              ).href,
              PREFERENCE_PATH: join(target, 'data/preferences.json'),
            },
          },
        );
      }

      it('round-trips packaged and weighted exact-product preferences', () => {
        const outputRoot = mkdtempSync(join(tmpdir(), 'store-preferences-'));
        expect(runGenerator(outputRoot).status).toBe(0);
        const source = `
          const helper = await import(process.env.PREFERENCE_HELPER);
          const path = process.env.PREFERENCE_PATH;
          helper.savePreference(path, 'example-store', {
            genericName: 'Milk', searchQuery: 'fresh milk', productId: 'milk-id',
            productName: 'Exact Milk 1 L', confirmedBy: 'authorized-person',
            quantityKind: 'packaged'
          });
          helper.savePreference(path, 'example-store', {
            genericName: 'Apples', searchQuery: 'apples', productId: 'apple-id',
            productName: 'Exact Apples', confirmedBy: 'authorized-person',
            quantityKind: 'weighted', recurringTarget: { quantity: 1.5, unit: 'kg' }
          });
          const registry = helper.loadPreferences(path, 'example-store');
          process.stdout.write(JSON.stringify({
            registry,
            found: helper.findPreference(registry, '  ＭＩＬＫ  ')
          }));
        `;

        const result = runPreferenceCode(outputRoot, source);

        expect(result.status).toBe(0);
        const output = JSON.parse(result.stdout);
        expect(output.registry.preferences).toHaveLength(2);
        expect(output.found).toMatchObject({
          genericName: 'Milk',
          productName: 'Exact Milk 1 L',
        });
      });

      it.each([
        [
          'unknown sensitive field',
          {
            genericName: 'Milk',
            searchQuery: 'milk',
            productId: 'milk-id',
            productName: 'Exact Milk',
            confirmedBy: 'authorized-person',
            quantityKind: 'packaged',
            token: 'not-allowed',
          },
        ],
        [
          'missing weighted target',
          {
            genericName: 'Apples',
            searchQuery: 'apples',
            productId: 'apple-id',
            productName: 'Exact Apples',
            confirmedBy: 'authorized-person',
            quantityKind: 'weighted',
          },
        ],
        [
          'invalid quantity',
          {
            genericName: 'Apples',
            searchQuery: 'apples',
            productId: 'apple-id',
            productName: 'Exact Apples',
            confirmedBy: 'authorized-person',
            quantityKind: 'weighted',
            recurringTarget: { quantity: 0, unit: 'kg' },
          },
        ],
      ])('rejects %s without changing the registry', (_name, preference) => {
        const outputRoot = mkdtempSync(join(tmpdir(), 'store-pref-invalid-'));
        expect(runGenerator(outputRoot).status).toBe(0);
        const registryPath = join(
          realpathSync(outputRoot),
          'example-store-shared-cart/data/preferences.json',
        );
        const before = readFileSync(registryPath, 'utf8');
        const source = `
          const { savePreference } = await import(process.env.PREFERENCE_HELPER);
          savePreference(process.env.PREFERENCE_PATH, 'example-store', JSON.parse(process.env.TEST_PREFERENCE));
        `;
        const result = spawnSync(
          process.execPath,
          ['--input-type=module', '--eval', source],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              PREFERENCE_HELPER: pathToFileURL(
                join(
                  realpathSync(outputRoot),
                  'example-store-shared-cart/lib/preferences.mjs',
                ),
              ).href,
              PREFERENCE_PATH: registryPath,
              TEST_PREFERENCE: JSON.stringify(preference),
            },
          },
        );

        expect(result.status).toBe(1);
        expect(readFileSync(registryPath, 'utf8')).toBe(before);
      });

      it.each([
        ['malformed JSON', '{'],
        [
          'unsupported schema',
          JSON.stringify({
            schemaVersion: 2,
            storeSlug: 'example-store',
            preferences: [],
          }),
        ],
        [
          'mismatched store',
          JSON.stringify({
            schemaVersion: 1,
            storeSlug: 'another-store',
            preferences: [],
          }),
        ],
        [
          'normalized duplicate',
          JSON.stringify({
            schemaVersion: 1,
            storeSlug: 'example-store',
            preferences: [
              {
                genericName: 'Milk',
                searchQuery: 'milk',
                productId: 'one',
                productName: 'One',
                confirmedBy: 'authorized-person',
                quantityKind: 'packaged',
              },
              {
                genericName: 'ＭＩＬＫ',
                searchQuery: 'milk',
                productId: 'two',
                productName: 'Two',
                confirmedBy: 'authorized-person',
                quantityKind: 'packaged',
              },
            ],
          }),
        ],
      ])('rejects a registry with %s', (_name, registry) => {
        const outputRoot = mkdtempSync(join(tmpdir(), 'store-registry-'));
        expect(runGenerator(outputRoot).status).toBe(0);
        const registryPath = join(
          realpathSync(outputRoot),
          'example-store-shared-cart/data/preferences.json',
        );
        writeFileSync(registryPath, registry);
        const source = `
          const { loadPreferences } = await import(process.env.PREFERENCE_HELPER);
          loadPreferences(process.env.PREFERENCE_PATH, 'example-store');
        `;

        expect(runPreferenceCode(outputRoot, source).status).toBe(1);
      });
    });
  });
});
