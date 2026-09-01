## Scheduled proactive-check scenarios

These cases start from the proactive cron prompt documented in `README.md`, not
from a household member's direct question. Each successful run is independent
and may make only one read call.

| Case                    | Scheduled condition                                                                                                                        | Expected action                                                                                                                                          | Expected delivery outcome                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| One recommendation      | `get_low_stock_predictions({})` returns one recommendation.                                                                                | Call the tool exactly once, preserve the returned product name, state, confidence, reason, and non-null recommended action, and call no mutation.        | Deliver one concise WhatsApp-ready message about that recommendation.                    |
| Several recommendations | The tool returns several recommendations in service-defined order.                                                                         | Call the tool exactly once, retain the returned order and facts, and consolidate every recommendation without reprioritizing or adding items.            | Deliver one concise WhatsApp-ready message covering the full returned list.              |
| Empty scheduled result  | The tool returns `{ recommendations: [] }`.                                                                                                | Call no other tool and respond with exactly `[SILENT]`.                                                                                                  | Record a successful local cron result and suppress WhatsApp delivery.                    |
| Sanitized MCP failure   | `get_low_stock_predictions` returns a safe tool error or its result is unavailable.                                                        | Do not retry, mutate, return `[SILENT]`, or claim that nothing is needed. Briefly state that the scheduled stock check could not be completed.           | Deliver the failure notice and retain the failed run in Hermes cron history.             |
| Blocked configuration   | Hermes preflight rejects the job because the skill, authenticated MCP connection, provider credentials, or WhatsApp target is unavailable. | Do not invoke the recommendation tool or reinterpret the block as an empty result. Correct the operator-owned configuration before a later run.          | Keep the job's blocked status and alert visible to the operator.                         |
| Later repeated run      | A later tick returns a recommendation that was also returned previously.                                                                   | Treat the tick as a fresh read, call the tool exactly once, and produce one consolidated message. Do not infer delivery history or silently deduplicate. | Deliver at most one message for the run; cadence is the MVP repeat-notification control. |

For scheduled scenarios, also verify:

- every successful scheduled tick calls `get_low_stock_predictions` exactly once;
- populated scheduled results preserve service order and produce one message;
- only a successful empty scheduled result produces exactly `[SILENT]`;
- scheduled failures stay observable and are never retried or converted to
  silence;
- no scheduled scenario calls a mutation or invents cross-run delivery state.
