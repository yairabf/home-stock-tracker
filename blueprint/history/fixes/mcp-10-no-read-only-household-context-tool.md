# Fix: MCP-10 read-only household context

**Type:** Fix
**Source:** `blueprint/context/bugs/mcp-10-no-read-only-household-context-tool.md`
**Status:** complete

## Completion record

- **Completed:** 2026-09-02
- **Delivered:** Home Stock Tracker now exposes a strict, no-argument
  `get_household_context` MCP tool that returns only the configured household's
  prediction-relevant context. The read never creates a default household,
  reports a stable setup error when configuration is missing, and is reserved
  in agent guidance for explicit household setup, configuration, and prediction
  explanation requests. The installer probe uses the same non-mutating read,
  validates its exact response, and reports only the reached household ID.
- **Main areas changed:** household service and DTO projection; MCP module,
  factory, transport tests, and PostgreSQL regression coverage; immutable MCP
  `1.2.0` fixtures and generated runtime contract; canonical scenarios and
  Hermes/OpenClaw skill bundles at `1.12.0`; installer probe validation; public
  API and integration documentation; refreshed Graphify outputs.
- **Verification:** `npm run test -- --runInBand` passed 52 suites and 757 tests;
  `npm run test:e2e -- --runInBand` passed 27 suites and 235 tests against
  PostgreSQL; `npm run contract:check` validated 93 scenarios and passed 6
  suites with 53 tests; `npm run build` passed; a live
  `npm run agent:probe -- --platform hermes` call against the running NestJS app
  and PostgreSQL returned `PROBE_OK` with the actual household ID and no policy
  payload; `git diff --check` passed; and `graphify update .` refreshed the
  repository graph.
- **Deviations:** None.

## Repository findings

- The gap exists at repository baseline
  `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96` and at current `HEAD`: MCP has no
  `get_household_context` tool.
- `HouseholdService.getOrCreate()` is the shared read used by prediction and
  recommendation services, but it creates the default household when none
  exists. Calling it from an advertised read-only tool or installer probe would
  violate the no-mutation acceptance criterion.
- `HouseholdResponseDto` also exposes `createdAt` and `updatedAt`. Those operator
  timestamps are not needed to explain predictions or verify the configured
  household and must not cross the MCP boundary.
- Prediction-relevant household state already lives in one `Household` row:
  composition, child age groups, prediction preferences, recommendation
  confidence threshold, and product policies. No schema change is needed.
- MCP contracts are discovered through a real client, captured as immutable
  versioned fixtures, and published from one shared release contract into
  generated Hermes and OpenClaw bundles. The current public MCP contract is
  `1.1.0` and the shared skill is `1.11.0`.
- The installer probe currently calls `grocery_list`. That proves a safe read
  works, but it cannot identify which household configuration the endpoint is
  serving.

## Goal

Expose the configured household's prediction-relevant context through one
strict, read-only MCP tool so an agent can answer explicit setup and explanation
questions, and so installation can verify the intended household without
creating or changing data.

## In scope

- Add a non-creating `HouseholdService` read that returns the existing household
  or a stable not-configured error.
- Add a dedicated agent-safe household-context projection containing only the
  household ID, composition, child age groups, prediction preferences,
  suggestion confidence threshold, and product policies.
- Register `get_household_context` with no arguments, a strict discoverable
  input schema, and a stable output schema.
- Keep the MCP handler thin by delegating household lookup and the missing-state
  rule to `HouseholdService`.
- Update the installer probe to call `get_household_context`, validate its
  structured response, and identify the reached household in its success output.
- Teach Hermes and OpenClaw to use the tool only for explicit household setup,
  configuration, and prediction-explanation questions.
- Publish the additive MCP contract as `1.2.0`, advance the shared skill to
  `1.12.0`, preserve older immutable fixtures, and regenerate both platform
  bundles.
- Update MCP/API and installation documentation, executable agent scenarios,
  and unit plus real-client regression coverage.

## Out of scope

- Creating or updating a household through MCP.
- Changing the existing REST household contract or its current `GET` behavior.
- Changing prediction, recommendation, product-policy, or confidence logic.
- Multi-household selection, caller-supplied household IDs, per-member access,
  or new authentication and authorization mechanisms.
- Returning credentials, creation/update timestamps, deployment details, raw
  environment values, or unrelated operator metadata.
- A database migration or persisted-data rewrite.

## Build loop

Build one step at a time, never the whole fix at once.

1. Plan the step before changing code.
2. Implement only that step.
3. Show the diff, not full files, and verify its done-when.
4. Wait for approval before continuing or creating a checkpoint.

Never accept a step that is too large to review. Split it before approval.

## Build steps

- [x] **Step 1 - Add a non-mutating household context read** - introduce an
      agent-safe response DTO/projection and a `HouseholdService` method that
      reads the existing single household without calling `create`; return a
      stable not-configured domain error when no row exists and cover both paths
      in service tests. _Done when:_ an existing household maps to the exact
      public context fields, a missing household produces the documented safe
      error, and neither path invokes `prisma.household.create` or changes the
      existing `getOrCreate()` behavior.

- [x] **Step 2 - Expose the strict read through MCP** - import
      `HouseholdModule`, inject `HouseholdService`, register
      `get_household_context`, and extend in-memory plus authenticated
      Streamable HTTP tests for runtime discovery, stable structured output,
      missing setup, unexpected failure sanitization, and strict rejection of
      all arguments. Add a PostgreSQL-backed MCP regression test proving the
      missing-household call does not insert a row. Atomically advance the MCP
      contract to `1.2.0`, capture its immutable fixture, and regenerate release
      artifacts so runtime discovery never drifts from the checked-in contract.
      _Done when:_ a real MCP
      client discovers a no-argument tool with the exact output schema; a valid
      call returns only the approved fields; malformed calls never reach the
      service; missing setup is safe and non-mutating; and all existing MCP
      tools continue to pass.

- [x] **Step 3 - Lock explicit-use agent behavior** - add the tool to the
      canonical tool matrix and responsibility rules, then add executable
      scenarios for household identification, configuration explanation,
      missing setup, and an ordinary prediction request that must not call the
      context tool. Update canonical scenario validation and its focused tests;
      advance the shared skill to `1.12.0` and regenerate both platform bundles
      so executable review tables and guidance remain atomic. _Done when:_ the shared source
      requires the tool only for explicit setup/context questions, preserves
      returned values without inference, performs no household mutation, and
      does not add a context lookup before routine inventory predictions or
      recommendations.

- [x] **Step 4 - Complete installation and public guidance** - update public API
      plus installation docs and regenerate Hermes and OpenClaw bundles with the
      completed guidance. Replace the probe's generic grocery read with
      the household-context read, validate the complete safe shape, include the
      returned household ID in the success diagnostic, and retain stable
      failure behavior without leaking secrets or policy payloads. _Done when:_
      the `1.0.0` and `1.1.0` fixtures are unchanged; generated manifests,
      fixtures, skills, and runtime discovery agree on the new versions and
      required tool; the installer probe names the reached household after one
      non-mutating call; contract checks, all tests, end-to-end tests, and the
      build pass.

## Files / areas

- `src/household/household.service.ts`
- `src/household/household.service.spec.ts`
- `src/household/dto/` (new agent-safe context DTO expected)
- `src/mcp/mcp.module.ts`
- `src/mcp/mcp-server.factory.ts`
- `src/mcp/mcp-server.factory.spec.ts`
- `src/mcp/mcp.controller.spec.ts`
- `test/` (focused household-context MCP end-to-end coverage)
- `scripts/agent-installation-probe.mjs`
- `scripts/agent-scenarios.mjs`
- `integrations/shared/home-stock-tracker/release-contract.json`
- `integrations/shared/home-stock-tracker/workflow.md`
- `integrations/shared/home-stock-tracker/scenarios/`
- `integrations/shared/home-stock-tracker/contracts/1.2.0/tools-list.json`
- Generated runtime contract and Hermes/OpenClaw bundle files under `src/mcp/`
  and `integrations/`
- `docs/api-reference.md`
- `docs/agent-integrations.md`

## Data / contracts

### MCP input

```json
{}
```

The object is strict. Unknown fields are rejected before service invocation.

### MCP output

```json
{
  "id": "household UUID",
  "adultsCount": 2,
  "childrenCount": 3,
  "childAgeGroups": ["child", "teen"],
  "predictionPreferences": null,
  "suggestionConfidenceThreshold": 0.7,
  "productPolicies": null
}
```

- This exact top-level shape is load-bearing for MCP clients and installer
  verification.
- `predictionPreferences` and `productPolicies` are nullable JSON objects because
  they directly influence prediction behavior. Treat values stored in those
  fields as agent-readable configuration; do not add unrelated or secret data.
- `createdAt`, `updatedAt`, credentials, environment data, and future household
  columns are excluded by explicit projection rather than entity spreading.
- If no household exists, return the stable safe message `Household is not
  configured`; do not synthesize defaults or create a row.
- This is an additive MCP change from `1.1.0` to `1.2.0`. Existing tools, REST
  contracts, stored data, and mutation semantics remain backward compatible.

## Testing

- Service tests cover the exact projection, missing-household error, and zero
  create/update calls for the new read.
- Factory and controller tests use real MCP clients to assert the runtime
  `tools/list` input/output schemas, strict empty input, structured response,
  safe domain errors, sanitized unexpected errors, and generic MCP operational
  logging.
- PostgreSQL-backed MCP coverage proves a configured household is returned and
  a missing household remains missing after the read.
- Agent contract tests prove explicit-use-only behavior and no mutations for
  setup questions, errors, predictions, or recommendations.
- Installer-probe tests prove household identification, schema validation,
  stable `SAFE_READ_FAILED` handling, one call only, and no credential or policy
  value leakage in diagnostics.
- Run `npm run contract:check`.
- Run `npm run test -- --runInBand`.
- Run the focused household-context MCP end-to-end test, then
  `npm run test:e2e -- --runInBand` against the documented PostgreSQL database.
- Run `npm run build` and `git diff --check`.
- After code changes, run `graphify update .`.

## Notes for the AI

- This is server and agent-contract work. There is no UI or design reference.
- Do not implement this tool with `getOrCreate()`. A read-only MCP call and
  installer probe must never initialize household state.
- Keep the missing-household rule in `HouseholdService`; MCP owns validation,
  explicit safe projection, delegation, and error translation only.
- Reuse the shared `runTool` boundary and generic MCP provenance/logging. Never
  expose stack traces, provider details, credentials, or full arbitrary payloads
  in probe diagnostics.
- Do not edit generated Hermes/OpenClaw skills, manifests, fixtures, or the
  generated runtime contract by hand. Change canonical shared sources and run
  the existing generators/capture workflow.
- Preserve immutable `1.0.0` and `1.1.0` fixtures and all unrelated working-tree
  changes.
- Reads must not create products or households, and this fix adds no write path.
