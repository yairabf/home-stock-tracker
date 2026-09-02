# Feature: Verifiable agent integration contract

**From build-plan:** feature 32
**Status:** complete

## Completion record

- **Completed:** 2026-09-02
- **Delivered:** Added one canonical, validated release contract for the service,
  MCP surface, compatible skills, required tools, and supported platforms. The
  generator now produces synchronized runtime constants, package and skill
  versions, portable Hermes/OpenClaw manifests, immutable normalized MCP schema
  fixtures, executable scenario guides, live probe commands, and release and
  rollback guidance. A read-only installation probe verifies health, readiness,
  authentication, MCP identity/version, exact tool schemas, tool visibility,
  and `grocery_list` before writes are enabled. The Wave 3 findings ledger and
  public operator documentation now map to explicit checked-in evidence.
- **Main areas changed:** `integrations/shared/home-stock-tracker/` owns release,
  schema, scenario, and platform sources; `scripts/` validates and generates
  artifacts and runs the installation probe; `src/mcp/` publishes and tests the
  runtime contract; generated Hermes/OpenClaw bundles carry self-contained
  manifests and fixtures; `docs/agent-integrations.md`, the root README, package
  scripts, and the bug triage publish and enforce the release workflow; and
  `graphify-out/` was refreshed for the new relationships.
- **Automated verification:** `npm run contract:check` validated 85 executable
  scenarios and passed 6 suites / 48 tests; `npm run skills:check` passed;
  `npm run test -- --runInBand` passed 52 suites / 734 tests;
  `npm run test:e2e -- --runInBand` passed 25 suites / 226 tests against local
  PostgreSQL; `npm run build` passed; focused `npx eslint` over the changed MCP
  TypeScript files passed; and `git diff --check` passed.
- **Behavioral evidence:** Against the running NestJS app,
  `GET /health` returned `{"status":"ok"}` and `GET /ready` returned database
  `up`. `npm run agent:probe -- --platform hermes` and the OpenClaw equivalent
  each returned `PROBE_OK` after live MCP initialization, exact schema/tool
  comparison, and a read-only `grocery_list`. Missing configuration returned
  exit 10, invalid authentication returned exit 23, and the supplied credential
  was absent from output. `graphify update .` refreshed the final graph to 4,433
  nodes and 6,039 edges.
- **Deviations:** None.

## Goal

Make the Home Stock Tracker service, MCP surface, and generated Hermes and
OpenClaw skills one versioned, machine-verifiable release contract. A fresh
installation must detect incompatible server, schema, skill, or platform
artifacts before writes are enabled, while repository checks prevent tool,
scenario, documentation, and generated-bundle drift.

MCP-06, MCP-07, MCP-09, and the Hermes/OpenClaw split are complete on the
current branch, so the tool surface required by this feature is now available.
This feature closes MCP-11 and SKILL-04 through SKILL-07 as one coordinated
unit.

## In scope

- Define one repository-owned release contract containing the service release,
  MCP contract version, compatible skill version/range, supported platforms,
  feature identifiers, required tools, and paths to versioned contract
  fixtures.
- Publish the MCP contract version through standard MCP initialization metadata
  and verify it together with the real runtime `tools/list` response. Use the
  SDK's initialization result rather than adding a custom capability tool.
- Store a normalized, versioned `tools/list` contract fixture and fail checks
  when runtime tool names, descriptions, input schemas, output schemas, or
  annotations drift from it.
- Generate service/MCP constants, skill versions, portable platform manifests,
  and install metadata from the release contract instead of maintaining those
  values independently.
- Replace the prose-only scenario source with machine-readable scenario
  fixtures that still generate readable Hermes and OpenClaw scenario guides.
- Validate scenario tool names, arguments, enum values, prerequisites, tool
  ordering, mutation uncertainty behavior, and platform safety rules against
  the published MCP fixture.
- Add a repository-owned, read-only installation probe for health/readiness,
  MCP initialization, server identity/version, `tools/list`, compatibility,
  and one authenticated `grocery_list` call.
- Update installation, compatibility, verification, rollback, API, and release
  documentation for Hermes, OpenClaw, and generic MCP clients.
- Reconcile the five Wave 3 bug briefs and triage ledger when the feature is
  verified.

## Out of scope

- New household, grocery, inventory, product, prediction, or persistence
  behavior.
- A database migration or persisted-data rewrite.
- A new `get_capabilities` MCP tool. Standard initialization metadata plus
  `tools/list` and the repository manifest are sufficient for the checked-in
  SDK client and probe.
- Mutation smoke tests. The installation probe remains read-only and never
  changes household state, even behind a default-on option.
- Automatic deployment, remote service changes, secret installation, package
  publishing, GitHub branch protection, or a new GitHub Actions workflow.
- Embedding tokens, deployment URLs, household IDs, recipient IDs, or
  store-specific configuration in manifests, fixtures, skills, or logs.
- Supporting additional agent platforms beyond Hermes and OpenClaw.
- Refactoring MCP domain handlers or changing existing tool semantics merely to
  simplify fixture generation.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Lock the release and compatibility contract** - add the
      canonical release contract and a focused loader/validator, define the SemVer
      compatibility policy, generate typed runtime constants, and replace the MCP
      server's hardcoded version with the contract version. Keep package and
      generated skill versions synchronized from the same source. _Done when:_ one
      reviewed source declares service, MCP, and skill versions; malformed versions,
      unsupported ranges, duplicate feature/tool identifiers, and secret-like or
      deployment-specific fields fail validation; generation synchronizes the
      package and lockfile release versions plus skill frontmatter rather than
      requiring manual duplicate edits; a real MCP client observes server name
      `home-stock-tracker` and the declared MCP contract version through
      initialization; and no custom capability tool is registered.

- [x] **Step 2 - Freeze the real MCP discovery contract** - capture a
      deterministic, versioned JSON fixture from the real in-memory MCP
      `tools/list` response, normalize ordering and non-contract noise, and add a
      check that compares runtime discovery with the current fixture. Preserve old
      fixtures and require an explicit new contract version before accepting a
      changed public schema. _Done when:_ all sixteen current tools, descriptions,
      input schemas, output schemas, and relevant annotations deep-match the
      fixture; changing a tool without selecting a new contract version fails the
      check; creating a new fixture cannot overwrite an existing version; and
      `npm run contract:check` verifies release metadata, runtime initialization,
      the fixture, and generated artifacts without a running database or network.

- [x] **Step 3 - Establish executable scenario fixtures** - define a strict
      machine-readable scenario shape and migrate the shared grocery, catalog, and
      product-resolution cases from prose tables. Record platform applicability,
      prerequisites, ordered calls, argument keys and enum values, expected result
      class, and named safety invariants without asserting final conversational
      wording. _Done when:_ every migrated scenario validates against the published
      MCP fixture; read-before-write prerequisites and user-confirmation gates are
      explicit; duplicate, update, alias, stale-state, cancellation, and uncertain
      mutation cases have machine-checkable expectations; and generated readable
      scenario tables remain semantically equivalent to the current guides.

- [x] **Step 4 - Complete scenario and bundle drift coverage** - migrate the
      inventory-history, stock-signal, prediction-feedback, purchase-completion,
      recommendation, and platform-specific cases; generate both platform scenario
      guides; and extend bundle checks to enforce complete scenario coverage and
      safety-rule presence. _Done when:_ every existing scenario has exactly one
      stable fixture ID; every referenced tool, argument, and enum exists; mutation
      scenarios cannot specify automatic retry after uncertain transport; required
      read and confirmation steps precede dependent writes; Hermes-only cron,
      WhatsApp, and `[SILENT]` cases stay out of OpenClaw; and hand-edited generated
      skill or scenario artifacts fail the test suite.

- [x] **Step 5 - Generate portable platform release manifests** - extend the
      existing skill generator to produce a non-secret manifest for Hermes and
      OpenClaw, map supported fields into each platform's skill frontmatter, and
      generate prerequisite, verification, compatibility, and rollback material
      from the central contract. _Done when:_ both bundles declare their platform,
      skill version, MCP server name, compatible MCP contract range, required tool
      set, authentication/network prerequisites, verification command, and rollback
      guidance; platform-unsupported metadata remains in the manifest or README
      rather than invalid frontmatter; each self-contained generated bundle carries
      the contract metadata and normalized schema material needed by the probe; and
      neither bundle contains credentials, household identifiers, deployment URLs,
      or the other platform's runtime conventions.

- [x] **Step 6 - Add the read-only installation probe** - add a script that
      selects `hermes` or `openclaw` through a non-secret CLI option, receives the
      service base URL and bearer token only through
      `HOME_STOCK_TRACKER_BASE_URL` and `HOME_STOCK_TRACKER_API_AUTH_TOKEN`, checks
      `/health` and `/ready`, connects to `/mcp` with the MCP SDK, validates server
      identity/version and `tools/list` against the selected bundle contract, calls
      `grocery_list`, and returns stable redacted diagnostics and exit codes. _Done
      when:_ success proves the live server and selected bundle are compatible;
      missing configuration, authentication failure, unreachable endpoints,
      disabled MCP, wrong server identity/version, schema drift, hidden tools, and a
      failed safe read each produce a distinct actionable failure; the token is
      absent from arguments, output, errors, fixtures, and generated files; and
      tests prove the probe never invokes a mutation tool.

- [x] **Step 7 - Publish the release workflow and close Wave 3** - replace
      hardcoded tool counts and duplicated version instructions with generated or
      manifest-backed references, document one probe command each for Hermes and
      OpenClaw plus a generic-client path, document version-bump and rollback rules,
      update package scripts and public references, and reconcile the bug README and
      triage decisions. _Done when:_ an operator can install, verify, diagnose, and
      roll back either bundle from checked-in documentation; stale tool counts or
      versions are rejected by automated checks; MCP-11 and SKILL-04 through
      SKILL-07 map to explicit evidence; the complete test/build/contract gate passes;
      and the knowledge graph is refreshed.

## Files / areas

- `package.json` and `package-lock.json`
- A canonical contract under `integrations/shared/home-stock-tracker/`
- Versioned MCP discovery fixtures under
  `integrations/shared/home-stock-tracker/contracts/`
- Machine-readable shared and platform scenario fixtures under
  `integrations/shared/home-stock-tracker/`
- `scripts/generate-agent-skills.mjs`
- New contract generation/check and read-only probe scripts under `scripts/`
- Generated runtime contract constants under `src/mcp/`
- `src/mcp/mcp-server.factory.ts`
- `src/mcp/mcp-server.factory.spec.ts`
- `src/mcp/mcp.controller.spec.ts`
- `src/mcp/agent-skill-contract.spec.ts`
- `src/mcp/agent-skill-generator.spec.ts`
- New focused contract, scenario, and probe tests under `src/mcp/` and `test/`
- `integrations/shared/home-stock-tracker/`
- Generated `integrations/hermes/home-stock-tracker/`
- Generated `integrations/openclaw/home-stock-tracker/`
- `docs/api-reference.md`
- `docs/agent-integrations.md`
- `docs/deployment.md`
- `docs/operations.md`
- `README.md`
- `blueprint/context/bugs/README.md`
- `blueprint/context/bugs/triage.md`

## Data / contracts

No Prisma model or database migration is planned.

The canonical release contract must represent at least:

- `service.name` and `service.version`.
- `mcp.serverName`, `mcp.contractVersion`, and the immutable current
  `tools/list` fixture path.
- `skill.version` and a machine-checkable compatible MCP SemVer range.
- Stable feature identifiers and the required MCP tool names.
- Supported platforms and their generated manifest targets.

Load-bearing rules:

- MCP `serverInfo.version` is the MCP contract version, not the MCP protocol
  version and not an independently hardcoded application version.
- Contract SemVer policy is explicit: breaking removals or incompatible schema
  changes require a major bump; additive tools or optional fields require a
  minor bump; non-contract corrections may use a patch bump.
- The committed fixture is produced from a real MCP SDK client connected to the
  actual `McpServerFactory`. Source-level Zod inspection alone is insufficient.
- Fixture normalization may stabilize object-key and tool ordering, but it must
  not remove descriptions, schemas, annotations, constraints, or enum values
  that clients observe.
- Existing versioned fixtures are immutable. A contract change creates a new
  version path and advances the central manifest instead of rewriting history.
- Skill compatibility is checked against MCP contract SemVer and exact required
  tool/schema expectations. Tool count alone is never compatibility evidence.
- Scenario fixtures use stable IDs and structured tool steps. Human-facing
  phrasing remains flexible, but selected tools, arguments, enums, order,
  confirmation gates, and safety invariants are contractual.
- Generated platform manifests contain metadata and instructions only. They
  never contain authentication values, concrete service URLs, household data,
  recipient identifiers, or secret environment values. Each generated bundle
  includes enough normalized contract data for its compatibility check without
  reaching back into repository-only paths.
- The probe reads its base URL and token from
  `HOME_STOCK_TRACKER_BASE_URL` and `HOME_STOCK_TRACKER_API_AUTH_TOKEN`, accepts
  only a platform selector as non-secret CLI input, redacts sensitive values,
  performs only HTTP/MCP reads, and exits non-zero on incompatibility before an
  operator enables writes.

## Testing

- Release-contract unit tests: valid versions/ranges, malformed and duplicate
  values, generated constant parity, package/skill synchronization, forbidden
  secret or deployment-specific fields, and standard MCP server metadata.
- Runtime MCP contract tests: real initialization metadata and full normalized
  `tools/list` equality against the immutable current fixture.
- Fixture tooling tests: deterministic output, refusal to overwrite a released
  fixture, explicit version advancement, and failure on unaccepted drift.
- Scenario tests: one-to-one fixture coverage, published tool/argument/enum
  references, ordered prerequisites, confirmation gates, stale/domain failures,
  uncertain-write no-retry invariants, and platform isolation.
- Generator tests: platform manifests, supported frontmatter, generated README
  sections, bundle currentness, and failure after hand-editing generated output.
- Probe tests: healthy success, missing env, 401, 404/disabled MCP, unreachable
  server, wrong identity/version, missing or changed tool, failed
  `grocery_list`, redaction, stable exit codes, and proof that no mutation method
  is invoked.
- Documentation checks: no hardcoded tool count or independently maintained
  service/MCP/skill version remains outside approved generated output.
- Final fallback gate because `AGENTS.md` has no Verify command: run
  `npm run contract:check`, `npm run skills:check`,
  `npm run test -- --runInBand`, the focused probe/HTTP e2e coverage through
  `npm run test:e2e -- --runInBand`, `npm run build`, focused ESLint for changed
  TypeScript files, and `git diff --check`.
- Run `graphify update .` after implementation changes so the knowledge graph
  includes the new contract, fixtures, scripts, and relationships.

## Notes for the AI

- Treat the release contract as the single authored source. Runtime constants,
  skill versions, platform manifests, scenario guides, tool-count prose, and
  compatibility documentation must be generated or checked against it.
- Extend the existing shared-source skill generator rather than adding a second
  competing generation pipeline.
- Keep `McpServerFactory` handlers and domain services unchanged unless a real
  public-schema extraction blocker is demonstrated and reviewed first.
- Use the MCP SDK client's `getServerVersion()` and `listTools()` results for
  compatibility checks. Do not infer compatibility from filenames or a tool
  count.
- Keep the probe importable/testable, deterministic, timeout-bounded, and
  read-only. Never print request headers or raw errors that may echo credentials.
- Preserve generic `mcp` provenance and all existing ambiguity, stale-state,
  idempotency, atomicity, and uncertain-transport safety rules.
- Generated artifacts should have a clear do-not-edit notice and be reproducible
  with repository scripts.
- Rollback instructions select a previously committed compatible bundle and
  contract fixture or release tag. They must never advise rewriting an immutable
  fixture or silently downgrading only one side of the service/skill pair.
- Keep steps reviewable. If scenario migration produces an oversized diff,
  split Steps 3 and 4 into smaller fixture batches without creating separate
  features or weakening the final one-to-one coverage gate.
