# Feature: Fail-closed store-skill scaffold

**From build-plan:** feature 34b
**Status:** verified

## Goal

Add a repository-owned generator that turns the feature 34a tutorial and adapter
contract into an isolated, store-specific starter skill. The generated bundle
must be safe before store code exists: invalid input writes nothing, existing
targets are never overwritten, adapter commands fail closed, and exact-product
preferences use a strict non-secret registry.

## In scope

- A Node.js scaffold generator exposed through an npm script.
- Strict validation for the store slug, display name, absolute HTTPS base and
  login URLs, locale, output root, supported arguments, and target collision.
- A deterministic `<store-slug>-shared-cart` starter bundle containing the
  store skill, non-secret store configuration, fail-closed adapter entry point,
  local preference registry and helper, copied adapter contract, usage guide,
  and local-data ignore rules.
- A generated adapter entry point that recognizes `status`, `cart`, `search`,
  and `ensure`, validates their arguments, performs no browser or network work,
  returns structured `not_implemented`, and exits non-zero.
- A strict preference helper that loads, validates, looks up, and atomically
  saves authorized exact-product choices without selecting or substituting a
  product.
- Automated tests for generator validation, all-or-nothing output, deterministic
  generated content, overwrite protection, fail-closed commands, preference
  round trips, malformed registries, and sensitive-content exclusions.
- Updates to the feature 34 documentation so the supported scaffold command and
  generated bundle boundary are discoverable.

## Out of scope

- A real retailer adapter, selectors, browser automation, container lifecycle,
  live session probing, login, OTP handling, vendor network calls, or product
  catalog discovery.
- Any real store, account, authorized identity, port, profile path, session ID,
  credential, cookie, token, product ID, selector, or populated preference in
  this repository.
- Checkout, payment, delivery or address changes, substitutions, order
  submission, or automatic retry after an uncertain mutation.
- Changing NestJS modules, Prisma data, REST/MCP contracts, Home Stock Tracker
  grocery state, or purchase completion behavior.
- Making a saved preference sufficient for a cart mutation. A future real
  adapter must still revalidate the exact product through a fresh live search.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the next step before editing.
2. Implement only that step and show its diff for review.
3. Verify its observable done-when before proceeding.
4. Keep checkpoints optional; `/complete` makes the feature commit after all
   steps and final checks pass.

## Build steps

- [x] **Step 1 - Lock and validate the scaffold command** - add the generator
  CLI, npm script, pure input parsing and validation, deterministic target-path
  calculation, and preflight collision check, with focused Jest coverage in the
  same diff. *Done when:* valid placeholder inputs produce an in-memory scaffold
  plan for `<output-root>/<store-slug>-shared-cart`; unknown, missing, malformed,
  non-HTTPS, credential-bearing, duplicate arguments, or a missing/non-directory
  output root fail non-zero with no target directory or partial file created;
  and any existing target is rejected without a force or overwrite path. The
  canonical computed target must also be outside the repository-owned portable
  tutorial bundle, including when the supplied output root is a symlink.
- [x] **Step 2 - Generate the isolated fail-closed starter bundle** - render the
  store-specific `SKILL.md`, `README.md`, `store.json`, `adapter.mjs`, copied
  adapter contract, `.gitignore`, and empty preference registry only after the
  full plan passes validation. *Done when:* two runs with the same placeholder
  inputs in separate temporary roots are byte-identical; every documented
  adapter command with valid arguments emits a structured `not_implemented`
  result, does no network or browser work, and exits non-zero; malformed or
  unknown commands emit structured `error` and fail non-zero; and the generated
  skill preserves the feature 34a responsibility,
  purchase-completion, exact-product, no-secret, and prohibited-operation
  boundaries.
- [x] **Step 3 - Add the strict preference registry helper** - generate a
  dependency-free helper for loading, validating, normalized generic-name
  lookup, and atomic replacement of the local preference registry, with unit
  and spawned-process tests. *Done when:* an authorized exact-product preference
  round-trips without changing source display text; lookup uses Unicode NFKC,
  trimming, locale-independent lowercase, and whitespace collapse; prohibited
  sensitive or unknown fields, duplicates after normalization, invalid
  quantities, mismatched store slugs, malformed JSON, and unsupported schema
  versions fail before mutation; weighted products require an explicit positive
  recurring target and unit; and a failed save leaves the previous valid
  registry intact.
- [x] **Step 4 - Publish and verify the scaffold workflow** - document the npm
  command, generated files, local/private data boundary, implementation TODOs,
  and promotion checks in the portable bundle and repository integration guide,
  then run the full gates. *Done when:* a reader can generate a placeholder
  scaffold without supplying secrets, understands that the output is not a
  working vendor adapter, cannot confuse cart placement with purchase
  completion, and `npm run test`, `npm run contract:check`, `npm run verify`, and
  `git diff --check` pass.

## Files / areas

- `scripts/generate-store-skill.mjs` - scaffold CLI, validation, planning, and
  all-or-nothing writes.
- `package.json` - `store-skill:scaffold` command.
- `src/tooling/store-skill-scaffold.spec.ts` - generator, generated-process,
  preference, safety, and overwrite tests using temporary directories.
- `integrations/hermes/online-grocery-store-integration/templates/` - authored
  deterministic templates or source fragments used by the generator.
- `integrations/hermes/online-grocery-store-integration/README.md` and
  `references/build-tutorial.md` - scaffold invocation and promotion guidance.
- `docs/agent-integrations.md` - public discovery link and command summary.

Generated output, outside the repository-owned template root:

```text
<output-root>/<store-slug>-shared-cart/
  .gitignore
  README.md
  SKILL.md
  adapter.mjs
  store.json
  data/preferences.json
  lib/preferences.mjs
  references/adapter-contract.md
```

## Data / contracts

### Generator CLI

```text
npm run store-skill:scaffold -- \
  --store-slug <lower-kebab-slug> \
  --display-name <non-empty-name> \
  --base-url <absolute-https-url> \
  --login-url <absolute-https-url> \
  --locale <valid-Intl.Locale-tag> \
  --output-root <path>
```

- The target is always `<output-root>/<store-slug>-shared-cart`; callers cannot
  supply individual generated paths.
- `--output-root` must already exist as a directory. The generator resolves its
  real path before calculating or validating the target.
- The target must not be inside
  `integrations/hermes/online-grocery-store-integration/`, including its
  repository-owned templates and references.
- URLs must use HTTPS and must not contain usernames, passwords, query strings,
  or fragments. The generator performs no URL fetch or reachability check.
- All arguments are validated and every rendered file is prepared before the
  first filesystem write.
- Files are staged in a unique sibling temporary directory and promoted only
  after the complete staged bundle passes validation. A failed generation cleans
  up only its own temporary directory and never touches the target.
- An existing target of any kind is a hard failure. There is no `--force`,
  merge, refresh, or overwrite mode.

### `store.json`

```json
{
  "schemaVersion": 1,
  "storeSlug": "example-store",
  "displayName": "Example Store",
  "baseUrl": "https://store.example",
  "loginUrl": "https://store.example/login",
  "locale": "en-US",
  "adapterCommands": ["status", "cart", "search", "ensure"]
}
```

This is non-secret configuration. It contains no account identity, browser
resource, session state, selector, product choice, service token, or credential.

### Adapter result

All generated commands write one JSON object to stdout and use a non-zero exit
status because the scaffold is not implemented:

```json
{
  "state": "not_implemented",
  "command": "status",
  "message": "Store-specific adapter behavior has not been implemented."
}
```

`search` requires one non-empty `--query`. `ensure` requires one non-empty
`--query`, one non-empty `--product-id`, and a positive finite `--quantity`.
These checks establish command shape only and never authorize a product or a
mutation. Unknown commands, duplicate arguments, missing required arguments,
and malformed quantities return the common `error` state, never
`not_implemented` or `ok`.

### `data/preferences.json`

```json
{
  "schemaVersion": 1,
  "storeSlug": "example-store",
  "preferences": []
}
```

Each populated preference has exactly this allowlisted shape:

```json
{
  "genericName": "milk",
  "searchQuery": "milk",
  "productId": "exact-store-product-id",
  "productName": "Exact current localized product name",
  "confirmedBy": "authorized-person-reference",
  "quantityKind": "packaged",
  "recurringTarget": {
    "quantity": 1,
    "unit": "package"
  }
}
```

- `quantityKind` is required and is `packaged` or `weighted`.
  `recurringTarget` is optional for packaged products and required for weighted
  products. When present, quantity is positive and finite and unit is non-empty.
- The helper rejects unknown fields. This allowlist excludes passwords, OTPs,
  cookies, tokens, account identifiers, browser state, session IDs, selectors,
  prices, and arbitrary metadata.
- A lookup result is only a candidate for fresh live revalidation. It never
  authorizes first-result selection, substitution, quantity conversion, or a
  cart mutation by itself.
- The registry is store-specific local operational data. The generated
  `.gitignore` excludes `data/preferences.json`; the generated README explains
  backup and permission ownership without describing it as a secret store.

These generated CLI, configuration, adapter-result, and preference shapes are
load-bearing for future store adapters.

## Testing

- Jest coverage is required for every generator validator and preference helper
  branch, including empty, missing, malformed, duplicate, collision, and
  unsupported-version cases.
- Spawn the generator only against temporary output roots. Assert both the full
  expected file set and absence of partial output on every failure path.
- Spawn each generated adapter command and assert structured output, non-zero
  status, and no network, browser, Home Stock Tracker, or vendor side effect.
- Verify overwrite protection with pre-existing file, directory, and sentinel
  contents; the sentinel must remain byte-identical.
- Round-trip valid packaged and weighted preferences, then prove invalid saves
  leave the previous registry byte-identical.
- Assert that generated JSON uses only its allowlisted keys and that executable
  files and placeholder fixtures contain no concrete credentials, cookies,
  tokens, sessions, private accounts, real vendors, real products, ports, or
  profile paths. Safety prose may name prohibited categories. This is a
  structural and fixture exclusion check, not a claim that arbitrary strings
  can be classified as secrets.
- No browser-test command is configured. Live authentication, browser behavior,
  product revalidation, cart idempotency, and modal behavior remain direct
  verification work for a future real adapter under the feature 34a matrix.
- Run focused Jest tests during each logic-bearing step and `npm run verify` as
  the final automated gate. Run `npm run contract:check` and
  `git diff --check` before completion.

## Notes for the AI

- Feature 34a is the load-bearing source contract. Do not weaken or reinterpret
  its result states, isolation rules, exact-product requirement, or completion
  boundary in generated text.
- Before implementation, confirm feature 34a has been merged to `main`, return
  to `main`, and create a fresh `feature/fail-closed-store-skill-scaffold`
  branch. Do not implement 34b on the current 34a branch.
- Keep the scaffold dependency-free and outside the NestJS runtime. Do not
  import it into `src/app.module.ts`, expose it through REST/MCP, or add Prisma
  data.
- Use Node filesystem and URL APIs. Preflight the complete operation before
  creating the target, stage generated bundles in a unique sibling temporary
  directory, and use temporary-file plus rename replacement for an existing
  preference registry.
- Never add a force flag, infer missing values, pick ports, access Docker, probe
  a URL, create a browser session, or include real integration data in tests.
- Preserve exact display text in stored preferences. Normalize only a derived
  lookup key and reject normalized collisions.
- Keep functions small and interfaces explicit. Use comments only for
  non-obvious safety decisions.
