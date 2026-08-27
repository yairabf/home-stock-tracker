# Feature: Proactive stock checks

**From build-plan:** feature 15
**Status:** complete

## Completion record

- **Completed:** 2026-08-28
- **Delivered:** Added a portable Hermes cron workflow for proactive stock
  checks. Scheduled runs call `get_low_stock_predictions` once, consolidate
  populated results into one WhatsApp-ready message, suppress successful empty
  results with `[SILENT]`, keep failures observable, and never mutate household
  state.
- **Changed areas:** `integrations/hermes/home-stock-tracker/SKILL.md` defines
  scheduled-run behavior; `README.md` documents skill-backed cron creation,
  operator-owned settings, verification, and lifecycle commands;
  `scenarios.md` records populated, empty, failure, configuration, and repeated
  run expectations.
- **Verification:** `npm run test -- --runInBand` passed 290 tests across 25
  suites; `npm run test:e2e -- --runInBand` passed 49 tests across 8 suites;
  `npm run build` passed; `git diff --check` passed. The scenario matrix proves
  the exact one-read, one-message, empty-silence, visible-failure, and
  no-mutation branches.
- **Deviations:** A live Hermes cron trigger and WhatsApp delivery were not run
  because the Hermes CLI/runtime and a non-production delivery target are not
  available in this workspace. The checked-in runbook provides the manual
  verification path for the deployment environment.

## Goal

Provide a portable, operator-controlled Hermes cron workflow that periodically
calls the existing `get_low_stock_predictions` MCP tool and delivers one concise
WhatsApp recommendation message only when the service returns actionable items.
Keep scheduling and message delivery in Hermes while the inventory service
continues to own prediction and recommendation policy.

## In scope

- Define the scheduled-run behavior in the checked-in Hermes skill: make exactly
  one recommendation read, trust the service's filtering, consolidate populated
  results into one useful message, and suppress delivery for an empty result.
- Provide a copy-ready Hermes cron prompt and operator setup instructions that
  attach the `home-stock-tracker` skill and deliver to the configured WhatsApp
  home channel.
- Require the operator to choose the cadence, timezone, and model/provider rather
  than committing household-specific or cost-sensitive defaults.
- Document prerequisites, manual triggering, status/history inspection, pause,
  edit, and removal so the automation can be safely operated and reversed.
- Exercise populated, empty, tool-failure, authentication/configuration-failure,
  and repeated-run scenarios without sending live WhatsApp messages from this
  repository.

## Out of scope

- A NestJS scheduler, external cron service, Redis, BullMQ, or a worker process.
- WhatsApp gateway setup, recipient IDs, credentials, live Hermes installation,
  or creation of a real cron job from this repository.
- Changing the low-stock recommendation threshold, prediction engine, MCP tool,
  service authentication, or product eligibility rules.
- Automatically adding recommendations to the grocery list or recording an
  inventory event merely because a scheduled check ran.
- Persisting notification delivery state, cross-run deduplication, snoozing, or
  product-specific notification policies. Cadence and one-message-per-run
  consolidation are the MVP controls against excessive notifications; richer
  policy belongs with feature 21 or a separately planned delivery-state feature.
- Operational health endpoints and structured integration logging (feature 17),
  deployment configuration (feature 18), and live end-to-end WhatsApp delivery.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lock scheduled-check behavior in the Hermes skill** - Add a
  dedicated proactive-run section that distinguishes scheduled execution from a
  user-requested read. It must call `get_low_stock_predictions({})` exactly once,
  preserve the returned ordering and facts, produce one concise household-facing
  message for a populated result, and return exactly `[SILENT]` for an empty
  result so Hermes suppresses delivery. It must never infer extra items, mutate
  the grocery list, retry an uncertain tool call, or hide a tool/configuration
  failure as an empty scan. *Done when:* the skill contains an unambiguous branch
  for populated, empty, and failed scheduled runs, while all existing interactive
  conversation rules remain unchanged.
- [x] **Step 2 - Add the portable cron setup and lifecycle runbook** - Extend the
  Hermes bundle README with a copy-ready named cron prompt and supported Hermes
  CLI/chat examples that attach `home-stock-tracker`, target `whatsapp`, and leave
  schedule, timezone, provider, and model as explicit operator choices. Document
  the installed skill and authenticated MCP prerequisites, gateway/cron status
  checks, a manual dry run, run-history inspection, and pause/edit/remove recovery
  commands. Do not patch Hermes' internal `jobs.json` or store credentials in the
  repository. *Done when:* an operator can install, create, manually trigger,
  inspect, pause, revise, and remove the job using documented public Hermes
  commands, and every environment-specific value is clearly marked rather than
  guessed.
- [x] **Step 3 - Prove the proactive conversation contract** - Expand the Hermes
  scenario matrix with scheduled results containing one and several
  recommendations, an empty result, a sanitized MCP failure, blocked
  authentication/configuration, and a later repeated run. Confirm that each
  successful tick makes one read, populated results become one WhatsApp-ready
  summary, empty results use `[SILENT]`, failures remain visible to the operator,
  and no scenario calls a mutation. *Done when:* the checked-in scenarios and a
  manual Hermes cron trigger cover every branch, the existing Jest and e2e suites
  remain green, and `npm run build` passes without adding a scheduler or changing
  service behavior.

## Files / areas

- `integrations/hermes/home-stock-tracker/SKILL.md` - scheduled execution rules,
  silence behavior, failure handling, and message constraints.
- `integrations/hermes/home-stock-tracker/README.md` - cron creation template,
  prerequisites, operator-owned choices, verification, and lifecycle commands.
- `integrations/hermes/home-stock-tracker/scenarios.md` - proactive-run review
  matrix and expected tool/delivery behavior.
- `src/`, `prisma/`, and `test/` - no runtime or schema changes expected; current
  recommendation and authenticated MCP contracts are reused unchanged.

## Data / contracts

- **Scheduled task owner:** Hermes cron. The NestJS service does not schedule or
  send notifications.
- **Attached skill:** `home-stock-tracker`.
- **Read operation:** exactly one `get_low_stock_predictions({})` call per run.
- **Input:** no tool arguments and no household/user identifier. The private
  single-household service and authenticated MCP connection determine scope.
- **Populated result:** consume the existing load-bearing
  `{ recommendations: LowStockRecommendation[] }` contract. Preserve product
  names, predicted states, confidence, reasons, recommended actions, and service
  ordering without recalculating qualification.
- **Empty result:** return exactly `[SILENT]`. Hermes cron treats this marker as a
  successful run whose delivery is suppressed while retaining local audit output.
- **Failure result:** do not return `[SILENT]`, retry automatically, or claim that
  stock is sufficient. Allow Hermes' sanitized tool/configuration failure to be
  visible through cron delivery and run history.
- **Delivery:** Hermes cron target `whatsapp`, resolved through the operator's
  configured WhatsApp home channel. No recipient or credential is checked in.
- **Schedule and timezone:** operator-owned deployment settings. The repository
  supplies placeholders and guidance, not a household-specific default.
- **Model/provider:** operator-owned and explicitly pinned for unattended work to
  avoid silently inheriting a cost-changing global model switch.
- This contract is load-bearing for the cron prompt and scenario matrix. Update
  all three Hermes bundle files together if `[SILENT]`, tool names, delivery
  targets, or the recommendation response changes.

## Testing

- Jest is configured, but this feature adds no new service logic. Do not add
  brittle tests that parse prose-only Hermes documentation.
- Review the scenario matrix against the skill and runbook for exact tool count,
  mutation absence, populated consolidation, empty suppression, and visible
  failures.
- In an installed non-production Hermes profile, create the job with an explicit
  test cadence/target, invoke it manually, and inspect status and run history.
  Use fixture or test-household outcomes for populated and empty paths; do not
  send a live household WhatsApp message as repository verification.
- Run `npm run test`, `npm run test:e2e`, and `npm run build` as regression gates
  because no umbrella Verify command is configured. Authentication-dependent e2e
  requests must continue to supply the service bearer token.

## Notes for the AI

- This is a Hermes integration/documentation feature. Do not install
  `@nestjs/schedule`, add `PREDICTION_CRON`, or create application scheduling
  code when Hermes already owns the selected trigger and delivery channel.
- Follow Hermes' public cron interface (`cronjob`, `/cron`, or `hermes cron`);
  never edit `~/.hermes/cron/jobs.json` directly.
- Keep the inventory service presentation-agnostic. WhatsApp-specific wording
  belongs only in the portable Hermes bundle.
- Keep interactive `get_low_stock_predictions` behavior intact. `[SILENT]` is
  valid only for the scheduled empty-result branch, not a direct user question.
- A failed check must be observable. Silence means a successful scan with no
  actionable recommendations, never an unavailable service or rejected request.
- Preserve the existing no-mutation recommendation boundary and service-owned
  filtering. Avoid unrelated MCP, prediction, authentication, or deployment
  refactors.
