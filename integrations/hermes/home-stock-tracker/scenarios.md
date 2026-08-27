# Hermes inventory skill scenarios

Use this matrix to review the skill against representative grocery and inventory
conversations. Arguments shown as `<resolved product id>` or `<listed item id>`
must come from the immediately preceding tool result, never from the model.

| Case | User request or condition | Expected action | Expected outcome |
| --- | --- | --- | --- |
| Add grocery item | "Add two liters of milk." | `grocery_add({ productName: "milk", requestedQuantity: 2, unit: "liters" })` | Summarize the returned pending item. |
| Invalid grocery quantity | "Add minus two milks." | Ask for a valid positive quantity. Do not call a tool. | No mutation occurs. |
| Add several grocery items | "Add milk and eggs." | Call `grocery_add({ productName: "milk" })`, then `grocery_add({ productName: "eggs" })`. | Summarize both confirmed additions in the user's order. |
| Item-specific measurements | "Add two liters of milk and eggs." | Call `grocery_add({ productName: "milk", requestedQuantity: 2, unit: "liters" })`, then `grocery_add({ productName: "eggs" })`. | Do not copy milk's quantity or unit to eggs. |
| Multi-add uncertain failure | The milk addition is confirmed, but the eggs mutation has an uncertain transport result. | Stop after the eggs result. Do not retry or attempt later additions. | Report milk as confirmed and eggs as uncertain. |
| List groceries | "What's on the grocery list?" | `grocery_list({})` | Summarize pending items. |
| Empty grocery list | `grocery_list` returns `{ items: [] }`. | Do not call another tool. | Say the pending grocery list is empty. |
| Remove one grocery item | "Remove milk from the list." | `grocery_list({})`, select one exact pending `productName`, then `grocery_remove({ id: <listed item id> })`. | Summarize the removed item. |
| Ambiguous grocery removal | Two pending items exactly match the requested name. | Ask which item to remove. Do not call `grocery_remove`. | No mutation occurs. |
| Product lookup | "Which product is whole milk?" | `get_product({ productName: "whole milk" })` | Summarize the canonical product and aliases. |
| Product lookup by known ID | The active context already contains a trusted product UUID and the user asks for that product. | `get_product({ id: <known product id> })` | Summarize the returned product. |
| Unknown product | `get_product({ productName: "oat milk" })` returns a not-found tool error. | Ask for another canonical name or known alias. Do not call a write tool. | No product is created. |
| Inventory estimate | "Did we probably run out of milk?" | `get_product({ productName: "milk" })`, then `get_inventory({ id: <resolved product id> })`. | State the returned predicted state, confidence, and reason without inventing a count. |
| Uncertain inventory | `get_inventory` returns `predictedState: "uncertain"`. | Do not call `grocery_add` or record a stock event. | Explain that there is not enough confidence to tell. |
| Purchase | "I bought three cartons of milk." | `get_product({ productName: "milk" })`, then `record_purchase({ productId: <resolved product id>, eventType: "PURCHASED", quantity: 3, unit: "cartons" })`. | Summarize the recorded purchase. |
| Explicit restock | "I restocked rice." | `get_product({ productName: "rice" })`, then `record_purchase({ productId: <resolved product id>, eventType: "RESTOCKED" })`. | Summarize the recorded restock without adding a quantity. |
| Future purchase | "I'll buy milk tomorrow." | Do not call `record_purchase`. | Treat it as a plan, not a completed event. |
| Low stock signal | "We're almost out of cereal." | `get_product({ productName: "cereal" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_LOW" })`. | Summarize the recorded low-stock observation. |
| Out-of-stock signal | "There is no rice left." | `get_product({ productName: "rice" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_OUT" })`. | Summarize the recorded out-of-stock observation. |
| Available-stock signal | "We still have plenty of rice." | `get_product({ productName: "rice" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_CONFIRMED" })`. | Summarize the availability confirmation. |
| Explicit correction | "Correction: we do still have milk." | Resolve whether the user is correcting an earlier stock record. If clear, call `get_product({ productName: "milk" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_CORRECTED" })`; otherwise ask what is being corrected. | Record only an explicit, sufficiently clear correction. |
| Ambiguous stock wording | "Milk situation changed." | Ask whether milk is low, out, available, or correcting an earlier record. Do not call a write tool. | No event type is guessed. |
| Low-stock recommendations | "What do we need?" | `get_low_stock_predictions({})` | Report only returned recommendations. |
| Empty recommendations | `get_low_stock_predictions` returns `{ recommendations: [] }`. | Do not add products or call another prediction tool. | Say there are no actionable recommendations now. |
| Domain failure | A mutation returns a validation or not-found tool error. | Report the safe error and correct only from known facts or ask a focused question. | Do not claim success. |
| Uncertain transport failure | A mutation call ends without a reliable result. | Report that the outcome is uncertain. Do not retry automatically. | Avoid a possible duplicate mutation. |
| Complete everything | "I bought everything." | `grocery_list({})`, then `complete_grocery_purchase({ groceryItemIds: <all returned pending item ids> })`. | Summarize only the completed items returned by the mutation. |
| Complete selected items | "I bought milk and eggs." | `grocery_list({})`; require one exact pending match for each name; call `complete_grocery_purchase` with those two IDs in user order. | Unmentioned pending items remain pending. |
| Complete everything except one item | "I bought everything except toilet paper." | `grocery_list({})`; require one exact `productName` match for toilet paper; call `complete_grocery_purchase` once with every other pending item ID. | Toilet paper remains pending; summarize confirmed completed items. |
| Complete everything except several items | "I bought everything except toilet paper and milk." | `grocery_list({})`; require one exact pending match for each exception; call `complete_grocery_purchase` once with all remaining IDs. | Both named exceptions remain pending. |
| Empty list completion | "I bought everything," then `grocery_list` returns no pending items. | Do not call `complete_grocery_purchase`. | Say the pending list was already empty. |
| Unmatched purchase name | "I bought everything except oat milk," but no pending `productName` is exactly `oat milk`. | Ask which pending item the user means. Do not mutate. | No item is guessed or completed. |
| Duplicate pending name | "I bought everything except milk," but two pending items have `productName: "milk"`. | Ask which milk item should remain pending. Do not mutate. | No arbitrary duplicate is selected. |
| All items omitted | Every pending item is named as an exception. | Do not call `complete_grocery_purchase`. | Explain that nothing was recorded as purchased. |
| List changes before completion | `complete_grocery_purchase` rejects because a selected item is no longer pending. | Read `grocery_list` again, explain the changed snapshot, and ask for fresh confirmation. | Do not retry the mutation automatically. |
| Compound domain failure | `complete_grocery_purchase` returns a validation or not-found tool error. | Report the safe error and do not claim any item was completed. | The all-or-nothing service leaves the batch uncommitted. |
| Compound uncertain failure | `complete_grocery_purchase` ends without a reliable result. | Report that the entire outcome is uncertain. Do not retry or issue per-item mutations. | Avoid duplicate purchase events and item completion. |

## Scheduled proactive-check scenarios

These cases start from the proactive cron prompt documented in `README.md`, not
from a household member's direct question. Each successful run is independent
and may make only one read call.

| Case | Scheduled condition | Expected action | Expected delivery outcome |
| --- | --- | --- | --- |
| One recommendation | `get_low_stock_predictions({})` returns one recommendation. | Call the tool exactly once, preserve the returned product name, state, confidence, reason, and non-null recommended action, and call no mutation. | Deliver one concise WhatsApp-ready message about that recommendation. |
| Several recommendations | The tool returns several recommendations in service-defined order. | Call the tool exactly once, retain the returned order and facts, and consolidate every recommendation without reprioritizing or adding items. | Deliver one concise WhatsApp-ready message covering the full returned list. |
| Empty scheduled result | The tool returns `{ recommendations: [] }`. | Call no other tool and respond with exactly `[SILENT]`. | Record a successful local cron result and suppress WhatsApp delivery. |
| Sanitized MCP failure | `get_low_stock_predictions` returns a safe tool error or its result is unavailable. | Do not retry, mutate, return `[SILENT]`, or claim that nothing is needed. Briefly state that the scheduled stock check could not be completed. | Deliver the failure notice and retain the failed run in Hermes cron history. |
| Blocked configuration | Hermes preflight rejects the job because the skill, authenticated MCP connection, provider credentials, or WhatsApp target is unavailable. | Do not invoke the recommendation tool or reinterpret the block as an empty result. Correct the operator-owned configuration before a later run. | Keep the job's blocked status and alert visible to the operator. |
| Later repeated run | A later tick returns a recommendation that was also returned previously. | Treat the tick as a fresh read, call the tool exactly once, and produce one consolidated message. Do not infer delivery history or silently deduplicate. | Deliver at most one message for the run; cadence is the MVP repeat-notification control. |

## Review record

For each row, verify:

- the selected tool exists in the MCP registry;
- every argument name and enum value matches its schema;
- every product UUID comes from `get_product` or trusted active context;
- every grocery-item UUID comes from `grocery_list`;
- `complete_grocery_purchase` receives a non-empty, unique, inclusive ID list;
- omitted items never appear in `complete_grocery_purchase` arguments;
- no optional quantity, unit, note, confidence, or metadata is invented;
- no mutation runs after an ambiguous request or uncertain mutation result;
- final wording reflects the structured result rather than claiming unobserved
  inventory facts;
- every successful scheduled tick calls `get_low_stock_predictions` exactly once;
- populated scheduled results preserve service order and produce one message;
- only a successful empty scheduled result produces exactly `[SILENT]`;
- scheduled failures stay observable and are never retried or converted to
  silence;
- no scheduled scenario calls a mutation or invents cross-run delivery state.
