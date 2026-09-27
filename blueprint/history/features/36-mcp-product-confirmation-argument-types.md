# Feature: Typed MCP arguments and same-conversation recovery

**From build-plan:** feature 36, GitHub issue #3
**Status:** verified by local tests and controlled Hermes replay; limits documented
**Branch:** `feature/mcp-product-confirmation-argument-types`

## Latest Hermes evidence (2026-09-28)

User supplied a real Hermes CLI conversation and logged disposable SDK harness
suite in session `20260927_213902_3e819e`. All four requested controlled cases
passed: one corrected call preserving earlier rows, clarification with missing
facts, stop after second validation rejection, and no retry after a simulated
post-commit timeout. Evidence assessment:
`blueprint/reference/feature-36/hermes-controlled-suite.md`.
Exclude the earlier direct-tool turn's unsupported malformed-rejection claim.
Failures were injected and prompts prescribed behavior; autonomous recovery
through Hermes native validation remains outside what this suite proves.
Production unchanged and disposable stack cleaned up, as reported. Ready for
completion review with these limitations; no further product changes indicated.

## Goal

Improve repository-owned MCP descriptions and generated agent skills so Hermes
constructs valid grocery arguments and recovers within the same conversation
when tool validation explicitly confirms no invocation. Preserve strict server
validation and require a real Hermes replay before declaring the issue fixed.

## In scope

- Clear typed examples for `grocery_add` and `grocery_confirm_new_product` in
  the relevant MCP descriptions and authoritative shared skill workflow.
- Explicit policy guidance: ordinary product names use proposal mode;
  `create_if_missing` requires complete approved `product` facts, not only
  `productName`. Resolution continues through the existing approval flow.
- Bounded recovery from explicitly non-invoked argument validation failures:
  correct representation of already approved facts and continue the current
  request without repeating previous successful mutations.
- Focused regressions for string quantities, string booleans, object aliases,
  policy/payload mismatch, and correctly typed equivalents.
- Recovery scenarios, generated Hermes/OpenClaw bundles, and consistent
  release metadata and immutable MCP fixtures for changed descriptions.
- Same-conversation Hermes replay and persistent-state evidence.

## Out of scope

- Server coercion, relaxed schemas, domain behavior changes, database migrations,
  or new mutation/recovery APIs.
- Unproven external serializer repairs or changes to Hermes runtime code.
- Automatic retry of dispatched mutations, conflicts, timeouts, ambiguous errors,
  or requests whose execution status is unknown.
- Deployment, installation changes, remote configuration, push, issue closure,
  retailer workarounds, or feature 37.

## Planning

- [x] Run Grillme before drafting the spec. User confirmed Q1-Q4 and shared
  understanding, then approved this scope revision after providing Hermes traces.
- Strict server validation remains required. Captured malformed requests do not
  prove a service defect or a serializer changing correctly typed inputs.
- Approved revision replaces the earlier constructor/serializer investigation
  gate with repository-owned MCP/skill guidance work. Missing external serializer
  source no longer blocks these implementation steps.
- Missing Hermes replay access still blocks completion, not local guidance work.
- Tests and build alone do not establish that an agent follows the new guidance.
- Record: `blueprint/context/feature-interview.md`.
- Size: one feature, five small reviewed steps. No build-plan edit or split needed.

## Before implementation

- Read `blueprint/config.json`; effective cadence is review every step, optional
  checkpoint commits, and manual regular audit/Check/Try gates.
- Preserve unrelated existing workflow/build-plan edits. Continue on the branch
  above. No commit or remote changes are authorized by this revision.
- Use captured requests as fixtures, not as permission to invoke production
  mutations. Earlier successful operations may already have changed the list.
- Inspect existing retry prohibitions and scenario validation before editing;
  add a narrow non-invocation exception without weakening conflict or transport
  uncertainty rules. Use Graphify for new investigation questions.
- Generate bundles from shared sources. Tool descriptions are part of discovery
  fixtures; follow release version policy and capture a new immutable fixture
  rather than overwriting contract 1.7.0. Record exact new versions in the step.
- Arrange an isolated test database and a Hermes test conversation for final
  replay. Capture installed Hermes/model/skill/MCP versions with replay evidence.
  Refresh actual tool descriptions and skills before replay; deployment or
  installation changes require separate authorization if needed.

## Investigation

- User trace: default-profile WhatsApp messages 13163-13164 in
  `@session:default/20260916_190020_c4fb4d5a`. Captured arguments and notes:
  `blueprint/reference/feature-36/hermes-failed-tool-call.json` and
  `blueprint/reference/feature-36/capture-notes.md`.
- Hermes rejected `product.isPerishable: "false"` with the explicit message
  `The tool was NOT invoked`. Quantity was also string `"1"`; aliases were
  `{ "item": "תערובת גריל עוף" }` rather than an array.
- Captured `grocery_add`: `blueprint/reference/feature-36/hermes-failed-grocery-add.json`.
  `create_if_missing` with `productName` but no `product` produced
  `Product input must match unknownProductPolicy`. This error alone is not proof
  of non-invocation; the pre-invocation recovery exception does not apply to it.
- Additional report: fabric-softener request in
  `@session:default/20260918_092330_923e2739` used string quantity and was blocked
  before service invocation. Its full raw call/result is not available.
- `src/mcp/schemas/grocery-confirmation.schema.ts:5` and
  `src/product/types/confirmed-product.schema.ts:4` already require correct types.
  Published `integrations/shared/home-stock-tracker/contracts/1.7.0/tools-list.json`
  agrees with the captured schema on boolean, number, and aliases-array fields.
- Graphify queries used during prior investigation: `grocery confirmation product
  schema mcp`, `client serialization manifest probe`, and `hermes skill generator
  confirmation product`. Broad outputs were truncated; conclusions were verified
  against surfaced sources rather than inferred from omitted nodes.
- `graphify explain "generate-agent-skills.mjs"` surfaced the generator;
  `scripts/generate-agent-skills.mjs:33` renders shared workflow and platform
  content. `integrations/shared/home-stock-tracker/workflow.md:163` provides
  generic confirmation guidance; line 190 already requires complete product facts
  for `create_if_missing`, but provides no complete typed confirmation example.
- `src/mcp/mcp-server.factory.ts:1084` registers the confirmation schema and
  forwards parsed input to the service. Existing factory tests around lines 818
  and 1098 establish typed forwarding and no-service-dispatch assertions.
- Graphify explanations for `agent-skill-generator.spec.ts`,
  `agent-release-contract.mjs`, and `agent-scenarios.mjs` surfaced generator,
  release, and scenario validation code. `policy-aware-grocery-addition.schema.ts`
  had no matching node; no source conclusion was drawn from that lookup.
- `integrations/shared/home-stock-tracker/release-contract.json` currently declares
  MCP 1.7.0, skill 1.17.0, and non-contract MCP changes as patch increments.

## Build loop

1. Plan and implement one small step with its relevant tests.
2. Show the diff, changed-file purpose, observable evidence, and how to try it.
3. Run focused tests and the declared `npm run verify` gate.
4. Obtain step approval before advancing; checkpoint commits need permission.

## Build steps

- [x] **Step 1 - Lock argument contracts with regressions.** Extend existing MCP
  transport/schema tests with captured malformed shapes and valid counterparts.
  *Done when:* string quantity, string boolean, and object aliases independently
  fail without mutation service dispatch; valid `true`, `false`, positive
  fractional quantity, and aliases arrays reach the service unchanged. The
  `create_if_missing`/missing-product combination is rejected by its existing
  boundary. Assert nested published types; do not change validators.
- [x] **Step 2 - Define typed construction and safe recovery in shared guidance.**
  Add complete JSON examples and explicit policy selection, plus scenarios for
  non-invoked recovery, missing approved facts, and execution uncertainty.
  Regenerate both skills/scenarios and update skill release metadata as needed.
  *Done when:* guidance specifies one bounded shape-only correction attempt in
  the same conversation, preserves approval and prior successful operations,
  asks when facts are missing, and stops for repeated failure or uncertain
  invocation. Scenario checks and focused generator tests pass. No general
  retry prohibition is removed to accommodate this exception.
- [x] **Step 3 - Align MCP descriptions and publish consistent artifacts locally.**
  Clarify native JSON types, aliases arrays, and `create_if_missing` requirements
  in relevant tool descriptions. Reference bounded non-invocation recovery
  without promising the server can observe client-side validation.
  *Done when:* runtime discovery and a newly versioned immutable fixture agree;
  generated manifests/bundles match their authoritative release contract;
  old fixture 1.7.0 remains unchanged; `npm run contract:check` passes. No
  request/response schemas or domain services are changed.
- [x] **Step 4 - Prove state behavior in an isolated flow.** Use existing test
  infrastructure to check invalid requests and approved valid confirmation.
  *Done when:* malformed inputs preserve catalog, names, grocery lines, and
  inventory events; valid confirmation produces the intended product and line
  with approved facts/quantity; prior successful work is not repeated. Mocked
  service forwarding alone is insufficient for persistent-state claims.
- [x] **Step 5 - Replay Hermes recovery and run final gates.** In a test conversation
  with updated descriptions/skill, recreate captured malformed-argument failures
  and the unknown-product flow. Record call order, arguments/results, versions,
  and state evidence. Run `npm run contract:check`, `npm run verify`, and
  `graphify update .` after code changes.
  *Done when:* Hermes corrects the explicitly non-invoked call within the same
  conversation using approved facts, without duplicate mutations or an unnecessary
  new approval; missing facts prompt clarification; unknown invocation stops
  automatic retry. Gates pass. Missing Hermes replay leaves this step incomplete.

## Files / areas

- `src/mcp/mcp-server.factory.ts`: relevant tool descriptions only.
- `src/mcp/mcp-server.factory.spec.ts`,
  `src/mcp/schemas/grocery-confirmation.schema.spec.ts`: typed contract regressions.
- `integrations/shared/home-stock-tracker/workflow.md` and
  `scenarios/grocery-catalog.json`: authoritative behavior/examples and scenarios.
- `src/mcp/agent-skill-generator.spec.ts`, `agent-scenario-contract.spec.ts`, and
  existing scenario validator: focused coverage; extend vocabulary only if needed.
- Shared release contract, new immutable fixture, runtime generated metadata,
  generated Hermes/OpenClaw bundles, and fixture-path tests: consistent publication.
- Existing relevant end-to-end tests: isolated persistent-state evidence.
- Spec/interview/capture notes: decisions and verification evidence.

## Data / contracts

- Existing confirmation shape remains
  `{ product: { canonicalName, aliases, category, typicalUnit, productType,
  isPerishable }, groceryItem: { requestedQuantity?, unit?, note? } }`.
- `isPerishable` is a boolean, quantity is a positive finite number if supplied,
  and `aliases` is an array of nonempty strings, including an empty array when
  explicitly approved as having no aliases. `false` is valid, never a truthy string.
- Omitted quantity preserves existing defaults and pending-line behavior.
  Do not guess missing facts, convert units, or alter approved identity/quantity.
- `create_if_missing` requires complete `product` facts; ordinary name requests
  use the existing proposal flow. Confirmation follows explicit user approval.
- **Load-bearing recovery exception:** only an explicit trustworthy client
  validation result that the tool was not invoked permits a shape-only correction
  and one retry of that approved operation. Check all argument types before it.
  Do not change approved meaning, replay an earlier successful mutation, or
  confuse this with domain errors and transport failures.
- No corrected retry if approval is missing, facts are ambiguous, the user changed
  intent, or invocation status is unknown. Clarify missing facts; for uncertainty,
  read current state before asking about another mutation. Existing conflicts and
  domain failures retain their existing no-automatic-retry behavior.
- Repeated validation rejection stops this correction loop and reports the actual
  remaining issue. Do not claim the service is broken from client validation alone.

## Testing

| Concern | Evidence |
| --- | --- |
| Primitive and array types | SDK transport rejection without dispatch plus exact valid forwarding; include false/fractional quantity and captured aliases object. |
| Policy mismatch | Existing validation boundary rejects name-only create_if_missing; valid complete-facts request preserves current behavior. |
| Guidance examples | Parse full JSON examples and validate against actual schemas; both generated platforms include agreed guidance. Avoid only substring tests. |
| Recovery rules | Scenarios distinguish explicit non-invocation, missing approval/facts, earlier success, repeated validation failure, domain conflict, and uncertain execution. Scenario checks do not prove LLM compliance. |
| Discovery publication | New fixture matches runtime; old fixture is unchanged; bundles/manifests are generated and current. |
| State safety | Relevant existing end-to-end flow against isolated PostgreSQL; capture before/after state. |
| Actual recovery | Hermes same-conversation replay with updated artifacts and typed successful call; no duplicate mutation. |

- Focused command: `npm run test -- --runInBand mcp-server.factory.spec.ts
  grocery-confirmation.schema.spec.ts agent-skill-generator.spec.ts
  agent-scenario-contract.spec.ts mcp-contract-fixture.spec.ts`.
- Contract gate: `npm run contract:check`. Final gate: `npm run verify`
  (unit tests then production build).
- Use `npm run test:e2e` with existing database setup and selected relevant suites;
  record exact setup/command before running. Do not introduce a runner silently.
- No Browser tests command or visual target. Hermes replay is direct evidence;
  arrange access and authorization for artifact installation separately if required.

## Notes for the AI

- This revision updates the plan only; no product changes are made in this turn.
- Keep NestJS transport thin and provenance/authentication server-owned.
- Shared recovery guidance is portable; Hermes-specific details stay in platform
  content. Never hand-edit generated bundles.
- `Boolean("false")`, indiscriminate coercion, schema relaxation, and automatic
  mutation retries are not remedies.
- Do not call prompt hardening a proven serializer fix. Track actual Hermes
  behavior separately from automated contract/scenario results.
- Critique applied: recovery is bounded to explicit non-invocation and approved
  representation corrections; policy errors are not assumed non-invoked; prior
  successes must not be repeated; description changes require consistent versioned
  fixtures; missing Hermes access blocks completion but not repository guidance work.

## Step 1 review evidence

- Changed `src/mcp/mcp-server.factory.spec.ts`: seasoning fixture based on the
  supplied trace; nested discovery type assertions; four independent malformed
  confirmation cases; valid true/false and fractional quantity forwarding; string
  quantity grocery addition and name-only create_if_missing rejection.
- `npm run test -- --runInBand mcp-server.factory.spec.ts
  grocery-confirmation.schema.spec.ts`: 2 suites, 131 tests passed.
- `npm run verify`: 72 suites, 1,023 tests passed; production build passed.
- `graphify update .`: completed AST-only update. Graphify refreshed community
  labels by their hub because the community set changed; no semantic rebuild used.
- `git diff --check`: passed. Domain services and schemas are unchanged.
- Reproduce locally using the focused test command. These assertions prove strict
  validation and service forwarding, not live Hermes behavior or persisted state.
- Step 1 review approved by the user. No checkpoint commit requested.

## Step 2 review evidence

- Shared workflow now includes native JSON examples and one corrected attempt
  after explicit non-invocation, preserving approval and prior successful work.
  Replaced overly broad validation-retry guidance; domain/uncertain outcomes stay
  under their existing final-result rules.
- Six new scenarios cover confirmation and quantity correction, missing facts,
  correction exhaustion, earlier success, and name-only policy mismatch.
- Scenario validator requires explicit non-invocation, approved intent, exactly
  one permitted grocery call, no fact invention, prior-success preservation,
  complete confirmation facts, and existing explicit approval. Negative tests
  cover missing gates, repeated calls, and uncertainty.
- Both generated platform bundles were regenerated. Skill version is 1.17.1;
  MCP schema/version remains 1.7.0 in this step. No remote installation changed.
- Focused tests: 4 suites, 106 tests passed.
- `npm run contract:check`: 119 scenarios validated; 6 suites, 74 tests passed.
- `npm run verify`: 72 suites, 1,033 tests passed; production build passed.
- `graphify update .` and `git diff --check`: passed. Graphify refreshed community
  names from their hub; no semantic rebuild or API call used.
- Generator tests parse both platforms' complete confirmation JSON examples and
  validate them against the actual strict confirmation schema.
- Step 2 review approved by the user. No checkpoint commit requested. Next: Step 3 MCP descriptions
  and new immutable discovery fixture. Actual Hermes replay remains outstanding.

## Step 3 review evidence

- Changed only `grocery_add` and `grocery_confirm_new_product` descriptions in
  `src/mcp/mcp-server.factory.ts`: native JSON examples, complete-facts policy
  requirements, one approved corrected attempt after explicit non-invocation,
  prior-success preservation, and no domain/uncertain retries.
- Contract 1.7.1 captured with `npm run contract:capture`; skill remains 1.17.1.
  Shared and both platform 1.7.1 fixtures are identical; manifests and runtime
  metadata were generated from the authoritative release contract.
- Added SDK tests that parse the actual description examples and dispatch them
  through registration validation. Added old/new fixture comparison proving only
  the two descriptions differ; all input/output schemas and other tool fields
  remain unchanged. Preserved old 1.7.0 fixtures byte-for-byte against git.
- Updated current-release test paths/assertions to 1.7.1; historical comparison
  deliberately continues using 1.7.0.
- `npm run test -- --runInBand mcp-server.factory.spec.ts
  mcp-contract-fixture.spec.ts`: 2 suites, 133 tests passed.
- `npm run contract:check`: 119 scenarios validated, 6 suites, 75 tests passed.
- `npm run verify`: 72 suites, 1,036 tests passed; production build passed.
- `graphify update .` and `git diff --check`: passed. AST-only update used no API.
- Step 3 review approved by user. No checkpoint requested. No commit or remote installation
  changed. Next: isolated persistent-state proof, then live Hermes recovery replay.

## Step 4 review evidence

- Extended `test/policy-aware-grocery.mcp.e2e-spec.ts` with five persistent-state
  tests using actual MCP HTTP transport and Prisma/PostgreSQL. Four malformed
  shapes leave the full product/name/grocery/event snapshots unchanged. A combined
  malformed confirmation followed by a typed correction creates exactly one new
  approved product, two names, and one pending line while preserving prior rows.
- Provider is stubbed as in the existing e2e harness; no LLM network request is
  made. Domain services and PostgreSQL are real. These tests do not prove Hermes
  complied with instructions or that a client emitted a non-invocation message.
- Created isolated database `home_stock_feature36_test` in the local PostgreSQL
  instance on localhost:5433. Applied 14 existing migrations; no migration files,
  main household database, or remote service were changed.
- Guarded orchestration script: `/private/tmp/home-stock-feature36-tests.cjs`.
  It loads local connection credentials without printing them, verifies the local
  host/port, and replaces only the database name for child commands. The script
  is temporary local tooling, not a new repository-owned test runner.
- Setup: `node /private/tmp/home-stock-feature36-tests.cjs migrate` runs
  `npm run db:migrate:deploy` against that isolated database.
- Proof: `node /private/tmp/home-stock-feature36-tests.cjs test` runs
  `npm run test:e2e -- --runInBand policy-aware-grocery.mcp.e2e-spec.ts
  policy-aware-grocery.service.e2e-spec.ts` with the isolated DATABASE_URL:
  2 suites, 29 tests passed.
- Sandbox initially blocked the local PostgreSQL connection and HTTP listener;
  reran the same commands with approval outside the sandbox. No source fix was
  needed for those environmental failures.
- `npm run verify`: 72 suites, 1,036 tests passed; production build passed.
- `graphify update .` and `git diff --check`: passed. Code graph refreshed AST-only.
- Step 4 review approved by the user. No checkpoint requested. Asked for Hermes test-profile
  location/access for Step 5. No live skill install, deployment, or commit performed.

## Step 5 access investigation

- Branch remains `feature/mcp-product-confirmation-argument-types`.
- Read-only local check: no `hermes` executable on PATH; no Hermes repository,
  virtual environment, test profile, skill installation, or session database in
  expected local paths. `~/.hermes/config.yaml` contains only plugin configuration;
  its plugins directory is empty. Printed configuration key names only, no secrets.
- No connected callable tool names/descriptions identified a Hermes integration.
  User session references are not filesystem paths or available connector handles.
- Prepared `blueprint/reference/feature-36/hermes-replay.md` with required versions,
  isolated target, replay cases, and explicit evidence criteria. No local/remote
  artifact installation, test message, or production mutation has been performed.
- Steps 1-4 are approved. Their focused tests, contract checks, full verify, and
  PostgreSQL proof already passed on the current product changes. Only planning
  notes changed afterward; no redundant product checks were rerun.
- Step 5 remains unchecked; final feature status is not verified. Need the runtime
  path, SSH host, or supported access mechanism for the actual Hermes test profile.
  Remote installation/config changes require separate authorization after the
  concrete target and artifact update are prepared.

## Remote rollout context and pending timing decision

- User clarified: Hermes normally reads the repository for its integration;
  Watchtower pulls updated service images published from main.
- Verified origin and `.github/workflows/verify.yml`: passing current main
  publication promotes `ghcr.io/yairabf/home-stock-tracker:latest`.
- Prepared `blueprint/reference/feature-36/update-sequence.md` with publication,
  complete skill installation/reload, MCP rediscovery, actual version checks,
  and the replay evidence packet. No remote actions performed.
- Pending user decision: move live Hermes replay to a post-update gate so their
  existing main-image rollout can make updated descriptions available. The
  current pre-completion gate remains in force until explicitly changed.
- If timing changes, record actual Hermes behavior as pending, not verified or
  resolved, until replay evidence arrives. Merge and push approvals are separate.

## Completion disposition, 2026-09-28

- Implementation was separately approved, committed as `eaa5118`, squash-merged
  to local main as `3a17515`, and pushed to origin/main with separate approvals.
  The GitHub Verify and Publish Docker image jobs succeeded.
- Subsequent loaded-skill inspection reported skill 1.17.1 and MCP description
  contract 1.7.1. An isolated bridge trace rejected the historical malformed
  shapes before dispatch and forwarded one typed correction. See
  `blueprint/reference/feature-36/hermes-replay-result.md`.
- A second real Hermes CLI conversation exercised four controlled cases through
  an injected-failure SDK harness; prior successful row preserved, missing
  facts prompted clarification, second rejection stopped retries, and a
  simulated post-commit timeout did not cause a duplicate write. The earlier
  unsupported claim of a malformed call was excluded. See
  `blueprint/reference/feature-36/hermes-controlled-suite.md`.
- These tests support the bounded recovery guidance but do not prove unprompted
  native-validator recovery or a Hermes runtime serializer repair. No service
  defect was established by the original client-side errors. Production was
  reported healthy with unchanged data after disposable test cleanup.
- Final gate rerun: `npm run contract:check` passed 119 scenarios and 75 tests;
  `npm run verify` passed 72 suites / 1,036 tests and production build.

## Publication preparation review

- User acknowledged the sequence: local review/commit, separately approved main
  merge and push, Watchtower service update, then Hermes bundle reload and replay.
- Final automated rerun: `npm run verify` passed 72 suites / 1,036 tests and
  production build; `npm run contract:check` passed 119 scenarios and 75 tests.
- `git diff --check` passed; feature/implement skills and feature templates match
  between `.agents` and `.claude`.
- Prepare a checkpoint commit of implementation and evidence without claiming
  live Hermes verification or archiving the feature. Existing workflow and plan
  edits remain separate from the product checkpoint. No commit, merge, or push
  performed; commit approval is the next action.
