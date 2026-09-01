# Fix: Separate Hermes and OpenClaw skill instructions

**Type:** Fix
**Status:** Complete

## Completion record

**Completed:** 2026-09-01

Home Stock Tracker now has one canonical platform-neutral workflow and scenario
source that deterministically generates self-contained Hermes and OpenClaw skill
bundles. Hermes retains its cron, WhatsApp, and `[SILENT]` behavior in a dedicated
adapter, while OpenClaw receives separate metadata, installation guidance, and an
interactive-only runtime contract without inherited Hermes delivery semantics.

Changed areas:

- `integrations/shared/home-stock-tracker/` - owns the canonical workflow,
  scenarios, and platform-specific generation inputs.
- `integrations/hermes/home-stock-tracker/` and
  `integrations/openclaw/home-stock-tracker/` - provide generated installable
  bundles plus platform-specific runtime and smoke-check documentation.
- `scripts/generate-agent-skills.mjs` and `package.json` - generate both bundles
  and expose currentness checks.
- `src/mcp/agent-skill-contract.spec.ts` and
  `src/mcp/agent-skill-generator.spec.ts` - prove shared contract parity,
  platform isolation, correct documented install paths, and failure on generated
  output drift.
- `docs/agent-integrations.md` - routes each platform to its own bundle and keeps
  other MCP clients pointed at the shared workflow.
- `graphify-out/` - refreshes the project knowledge graph after code changes.

Verification:

- `npm run skills:check` - passed with both committed bundles current.
- `npm run test -- --runInBand src/mcp/agent-skill-generator.spec.ts src/mcp/agent-skill-contract.spec.ts` - 2 suites and 38 tests passed.
- `npm run test -- --runInBand` - 47 suites and 635 tests passed.
- `npm run build` - NestJS build passed.
- `git diff --check` - passed.
- `rg -n 'Hermes|WhatsApp|SILENT|hermes cron|\.hermes|integrations/hermes' integrations/openclaw/home-stock-tracker` - returned no matches.
- `graphify update .` - rebuilt the code graph with 4,414 nodes, 5,939 edges,
  and 360 communities. It retained the existing version and optional SQL-parser
  warnings.
- The generator drift test changed an isolated temporary OpenClaw bundle and
  confirmed `--check` failed without touching the real generated artifacts.

**Deviations:** Neither platform CLI is installed in this environment, so a live
skill installation and agent session smoke test could not be run. Bundle layout,
commands, generated content, and contamination boundaries were verified
statically and through automated contract tests.

## The problem

The checked-in agent integration is presented as reusable by Hermes and
OpenClaw, but only `integrations/hermes/home-stock-tracker/` exists. The
OpenClaw guide installs that Hermes bundle even though its `SKILL.md` now
contains Hermes-only cron behavior, the `[SILENT]` delivery marker, and
WhatsApp-oriented output rules. Its frontmatter is also explicitly
Hermes-shaped.

The gap still exists on the current branch and is larger than at baseline
`4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`: later grocery workflows were added
to the same mixed bundle, and `src/mcp/hermes-skill-contract.spec.ts` protects
only that copy. The shared grocery and inventory workflow is valid for both
agents, but installation, metadata, scheduling, delivery, sandboxing, and
lifecycle instructions are platform concerns.

This is an integration packaging and documentation defect. It does not require
a domain-service change, REST or MCP contract change, database migration, or
persisted-data compatibility work.

## The fix

Create one canonical, platform-neutral Home Stock Tracker workflow and scenario
source, then deterministically generate self-contained Hermes and OpenClaw skill
bundles from it. Each generated bundle must contain the same shared tool rules
while retaining only its own metadata and runtime instructions.

- Keep Hermes installation, cron, WhatsApp delivery, and `[SILENT]` behavior in
  the Hermes adapter and README.
- Add a dedicated OpenClaw bundle and README using the current official local
  skill, MCP registry, probe, workspace/global scope, sandbox, and reload/session
  contracts.
- Do not add an OpenClaw scheduled-check workflow in this fix. OpenClaw has its
  own automation and delivery model, so it must not inherit Hermes cron,
  WhatsApp, or `[SILENT]` behavior by omission.
- Replace the Hermes-only contract test with an agent-integration contract test
  that fails on generated-file drift, proves the shared workflow is present in
  both bundles, and proves Hermes-only terms are absent from OpenClaw artifacts.
- Update `docs/agent-integrations.md` to point each platform at its own bundle
  and stop claiming that the Hermes skill body is agent-neutral.

The generated bundles remain directly installable because each platform still
receives a complete root-level `SKILL.md`; installed skills do not depend on
repository-relative links back to the shared source.

## Build steps

- [x] **Step 1 - Split the canonical workflow from platform adapters.** Add the
  shared workflow/scenario sources, a small deterministic generator, and
  platform-specific source material. Generate complete Hermes and OpenClaw
  bundles. Preserve every current shared tool-selection, ambiguity, stale-write,
  and uncertain-transport rule. Keep scheduled proactive checks and their
  scenarios only in Hermes output. Done when both bundle roots contain a valid,
  self-contained `SKILL.md`, their shared sections are generated from one source,
  and no OpenClaw artifact contains Hermes profile paths, `hermes cron`,
  `[SILENT]`, or WhatsApp home-channel assumptions.

- [x] **Step 2 - Correct installation docs and lock the boundary with tests.**
  Update each platform README and `docs/agent-integrations.md` with its own
  official install, MCP probe, visibility, sandbox, and reload/session guidance.
  Replace the Hermes-only contract test with coverage for both generated bundles
  and add a generator drift check so hand-edited output fails. Done when the
  documentation never directs OpenClaw to `integrations/hermes`, the shared
  workflow assertions pass for both agents, and platform-contamination and drift
  regressions fail the test suite.

## Verify

- Run the skill generator in check mode and confirm the committed Hermes and
  OpenClaw bundles are current.
- Run `npm run test` and confirm the agent-integration contract covers both
  bundles, shared workflow parity, and forbidden platform-specific terms.
- Run `npm run build`.
- Review both install paths from a clean target directory and confirm each
  bundle has a root `SKILL.md` plus only platform-appropriate supporting files.
- Confirm `docs/agent-integrations.md` maps Hermes and OpenClaw to separate
  bundles and preserves the generic MCP contract for other clients.
