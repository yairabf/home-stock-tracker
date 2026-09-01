# Fix: MCP-07 prediction feedback tool

**Type:** Fix
**From bug brief:** `blueprint/context/bugs/mcp-07-no-prediction-feedback-tool.md`
**Status:** complete

## Completion record

**Completed:** 2026-09-01

MCP clients can now record accepted, rejected, or corrected feedback for one
trusted prediction through the shared transactional domain service. The new
tool publishes strict input and structured output schemas, owns `mcp`
provenance at the transport boundary, preserves safe conflict behavior, and is
documented in the Hermes agent workflow.

**Changed areas:**

- MCP tool registration, schemas, service wiring, and focused contract tests.
- Persistence-backed Streamable HTTP coverage for accepted, rejected,
  corrected, malformed, repeated, unknown, and concurrent submissions.
- Hermes skill guidance, scenario routing, public MCP documentation, project
  overview, and refreshed Graphify artifacts.

**Verification:**

- `npm test -- --runInBand` passed: 46 suites and 626 tests.
- `npm test -- --runInBand hermes-skill-contract.spec.ts mcp-server.factory.spec.ts mcp.controller.spec.ts` passed: 3 suites and 91 tests.
- `DATABASE_URL=postgresql://home_stock:home_stock@localhost:5432/home_stock_tracker?schema=public npm run test:e2e -- --runInBand prediction-feedback.mcp.e2e-spec.ts prediction-feedback.e2e-spec.ts` passed: 2 suites and 23 tests.
- `DATABASE_URL=postgresql://home_stock:home_stock@localhost:5432/home_stock_tracker?schema=public npm run test:e2e -- --runInBand prediction-feedback.mcp.e2e-spec.ts` passed: 1 suite and 14 tests after tightening concurrency assertions.
- `npm run build`, focused ESLint for every changed TypeScript file, and
  `git diff --check` passed.

**Behavioral evidence:** The real authenticated Streamable HTTP MCP client and
PostgreSQL tests observed persisted feedback state, event metadata, accuracy
updates, corrected stock events, mutation-free failures, and exactly one winner
under concurrent feedback.

**Deviations:** None.

## Goal

Expose the existing prediction-feedback domain operation through MCP so an
agent can accept, reject, or correct one exact prediction returned by a trusted
active or fresh prediction read. Keep REST and MCP on the same transactional
service path, and teach the agent to distinguish prediction feedback from a
general stock correction.

## Repository findings

- The gap exists at current commit `2d4c7df92af78480c42eca1b1e9a3e201254f902`
  and at baseline `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`.
  MCP returns `predictionId` from `get_inventory` and
  `get_low_stock_predictions`, but registers no feedback tool.
- REST already exposes
  `POST /api/v1/inventory/predictions/:predictionId/feedback` through the thin
  `InventoryController`, which delegates to `PredictionFeedbackService` with
  transport-owned `api` provenance.
- `PredictionFeedbackService.submitFeedback` already owns the required domain
  behavior in one Prisma transaction: pending-only conditional update, feedback
  event creation, corrected-state validation, and prediction-accuracy refresh.
  Corrected feedback creates one `STOCK_CORRECTED` event in that transaction.
- Repeated or concurrent feedback currently has defined conflict behavior: any
  second submission, including an identical retry, returns
  `Prediction feedback was already recorded` and creates no second event.
- The MCP factory already maps Nest domain exceptions to safe tool errors and
  assigns generic `mcp` provenance at its mutation boundary. The smallest
  coherent fix is to inject the existing feedback service, not duplicate rules
  in the MCP handler.
- The checked-in agent skill currently routes an explicit correction to
  `record_stock_signal(STOCK_CORRECTED)` without distinguishing feedback about a
  specific prediction. Its tool list, scenario matrix, contract test, install
  guide, and public MCP reference need the new contract.
- The existing `Prediction`, `FeedbackStatus`, `InventoryEvent`, and
  `ProductStatistics` shapes support the fix. No database migration or existing
  data rewrite is expected.

## In scope

- Register a strict MCP tool named `record_prediction_feedback`.
- Reuse `PredictionFeedbackService.submitFeedback` with server-owned `mcp`
  provenance.
- Publish a discoverable single-object input schema and an explicit structured
  output schema.
- Preserve existing accepted, rejected, corrected, transaction, accuracy,
  conflict, and safe-error behavior.
- Prove source-level MCP wiring and persistence-backed behavior through real MCP
  clients.
- Update the agent skill and scenarios so only feedback about one unambiguous
  prediction uses the new tool.
- Update the project overview, MCP documentation, and integration documentation,
  including the published tool count.

## Out of scope

- Changing the existing REST route or domain feedback semantics.
- Adding an arbitrary prediction age cutoff or latest-prediction-only rule. The
  domain has no approved expiration policy; freshness and reference provenance
  are guarded by the agent workflow.
- Making repeated writes idempotently successful. Existing pending-only conflict
  behavior remains the explicit concurrency and retry contract.
- Adding a feedback-status read endpoint or tool.
- Changing prediction generation, confidence thresholds, or recommendation
  filtering.
- Adding a second stock event for corrected feedback. The shared operation
  already records the corresponding `STOCK_CORRECTED` observation atomically.
- Database schema changes, new infrastructure, or unrelated MCP tools.

## Build loop

Build one step at a time, never the whole fix at once.

1. Plan the step before code.
2. Implement only that step.
3. Show the diff and verification evidence.
4. Continue only after review and approval.

## Build steps

- [x] **Step 1 - Add the MCP feedback contract and adapter** - export and inject
  `PredictionFeedbackService`, define strict input and output schemas, register
  `record_prediction_feedback`, and add focused in-memory MCP tests for runtime
  discovery, valid forwarding, transport-owned provenance, schema rejection,
  structured results, and safe domain errors. *Done when:* a real in-memory MCP
  client discovers one object schema with the conditional corrected-state rules,
  valid calls invoke the shared service exactly once with `source: "mcp"`,
  invalid calls do not reach the service, domain errors remain safe, and
  unexpected errors expose no internals.
- [x] **Step 2 - Prove persisted MCP and REST parity** - add a
  persistence-backed Streamable HTTP MCP regression suite for accepted,
  rejected, corrected, unknown, malformed, repeated, and concurrent-safe paths,
  while retaining the existing REST feedback suite as parity evidence. *Done
  when:* MCP updates the exact prediction deterministically, corrected feedback
  writes exactly one linked `STOCK_CORRECTED` event in the shared transaction,
  every second submission conflicts without another event, malformed inputs do
  not mutate, and the existing REST feedback tests remain green.
- [x] **Step 3 - Teach and document the feedback workflow** - update the agent
  skill, installation tool list, executable scenario matrix, skill contract
  tests, MCP API reference, and integration guide. *Done when:* instructions use
  only a non-null prediction ID from the active interaction or a fresh read,
  accept or reject only an unambiguous referenced prediction, map a known
  corrected state through one feedback call, keep unrelated stock corrections
  on `record_stock_signal`, forbid blind retries after uncertain writes, and all
  automated checks and the graph refresh pass.

## Files / areas

- `src/inventory/inventory.module.ts`
- `src/inventory/prediction-feedback.service.ts` (reuse; change only if
  investigation exposes a shared-domain defect)
- `src/inventory/dto/prediction-feedback.dto.ts` (reuse contract values)
- `src/inventory/dto/prediction-feedback-response.dto.ts` (reuse response shape)
- `src/mcp/mcp-server.factory.ts`
- `src/mcp/mcp-server.factory.spec.ts`
- `src/mcp/mcp.controller.spec.ts`
- `src/mcp/hermes-skill-contract.spec.ts`
- `test/prediction-feedback.e2e-spec.ts`
- `test/prediction-feedback.mcp.e2e-spec.ts` (expected new file)
- `integrations/hermes/home-stock-tracker/SKILL.md`
- `integrations/hermes/home-stock-tracker/scenarios.md`
- `integrations/hermes/home-stock-tracker/README.md`
- `docs/api-reference.md`
- `docs/agent-integrations.md`
- `blueprint/context/project-overview.md`

## Data / contracts

No persistence changes are planned.

The load-bearing MCP input is one strict object:

```json
{
  "predictionId": "UUID returned by an active or fresh prediction read",
  "outcome": "accepted | rejected | corrected",
  "correctedState": "likely_available | probably_low | probably_out"
}
```

Contract rules:

- `predictionId` is a required UUID. It must be a non-null ID returned by
  `get_inventory` or `get_low_stock_predictions` in the active interaction, or
  by a fresh read made to resolve the user's reference. Never guess or reuse an
  unrelated ID.
- `outcome` is required and accepts only `accepted`, `rejected`, or `corrected`.
- `correctedState` is required only when `outcome` is `corrected`, accepts only
  the three concrete states, and must differ from the stored predicted state.
  It is forbidden for accepted or rejected feedback.
- `source` is not a public input. The MCP adapter supplies `mcp`.
- Accepted feedback stores `FeedbackStatus.accepted` and one
  `PREDICTION_ACCEPTED` event.
- Rejected feedback stores `FeedbackStatus.rejected` and one
  `PREDICTION_REJECTED` event.
- Corrected feedback stores `FeedbackStatus.rejected` and one
  `STOCK_CORRECTED` event whose metadata links the prediction and both states.
- Any repeated or concurrent submission conflicts, even if its payload matches
  the first. Agents must not blindly retry a write with an uncertain transport
  result.
- Unknown IDs return the existing safe not-found result. Schema failures and a
  correction equal to the original state fail without mutation.

Successful structured output mirrors `PredictionFeedbackResponseDto`:

```json
{
  "predictionId": "UUID",
  "productId": "UUID",
  "feedbackStatus": "accepted | rejected",
  "outcome": "accepted | rejected | corrected",
  "correctedState": "likely_available | probably_low | probably_out | null",
  "feedbackEventId": "UUID",
  "predictionAccuracy": 0.75
}
```

Agent workflow rules:

- “Yes, that was right” maps to `accepted` only when one prediction in active
  context is unambiguously referenced.
- “No, we still have milk” in response to a specific prediction maps to
  `corrected` with `correctedState: "likely_available"`; the single feedback
  operation also records the stock observation.
- A general correction or direct stock observation with no specific prediction
  reference stays on `record_stock_signal`.
- If the reference is ambiguous, stale in conversation, or has a null ID, ask or
  make a fresh prediction read before any mutation.

## Testing

- Unit and in-memory MCP tests: exact runtime `tools/list` schema and order,
  strict unknown-field rejection, conditional `correctedState` validation,
  handler forwarding, generic provenance, response serialization, safe domain
  errors, and sanitized unexpected errors.
- Persistence-backed MCP tests: accepted, rejected, and corrected prediction
  rows; event type, source, and metadata; accuracy updates; unknown UUID;
  malformed input; correction equal to the prediction; repeat conflict; and no
  duplicate event.
- Existing REST regression: run `test/prediction-feedback.e2e-spec.ts` unchanged
  unless a shared-domain correction genuinely requires an assertion update.
- Agent contract tests: tool discovery documentation and executable scenarios
  for accepted, rejected, corrected, ambiguous, null-ID, general correction,
  repeated conflict, and uncertain transport outcomes.
- Final fallback gate because no `Verify` command exists: run
  `npm run test -- --runInBand`, focused prediction-feedback e2e suites,
  `npm run build`, and `git diff --check`.
- Run `graphify update .` after code and documentation changes.

## Notes for the AI

- This is a fix loaded from MCP-07. Do not edit `blueprint/build-plan.md`.
- Create or continue branch `fix/mcp-07-prediction-feedback-tool` during
  implementation. Do not commit without approval.
- Keep the MCP handler thin and preserve `PredictionFeedbackService` as the
  shared domain/application owner for REST and MCP.
- Use one strict Zod object with runtime refinement, not a top-level union.
- Do not accept caller-controlled provenance or channel-specific source values.
- Do not add time-based staleness semantics without a separately approved domain
  policy.
- Preserve MCP safe-error and structured-content conventions.
- Do not silently retry prediction feedback after an uncertain transport result.
- No em dash, en dash, or ellipsis characters in generated content.
