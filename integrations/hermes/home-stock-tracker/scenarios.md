# Hermes inventory skill scenarios

Use this matrix to review the skill against representative single-intent
requests. Arguments shown as `<resolved product id>` or `<listed item id>` must
come from the immediately preceding tool result, never from the model.

| Case | User request or condition | Expected action | Expected outcome |
| --- | --- | --- | --- |
| Add grocery item | "Add two liters of milk." | `grocery_add({ productName: "milk", requestedQuantity: 2, unit: "liters" })` | Summarize the returned pending item. |
| Invalid grocery quantity | "Add minus two milks." | Ask for a valid positive quantity. Do not call a tool. | No mutation occurs. |
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
| Compound purchase completion | "I bought everything except toilet paper." | Do not approximate with repeated `record_purchase`, `grocery_remove`, or other single-product calls. | Explain that this compound flow requires the grocery-conversation workflow. |

## Review record

For each row, verify:

- the selected tool exists in the MCP registry;
- every argument name and enum value matches its schema;
- every product UUID comes from `get_product` or trusted active context;
- every grocery-item UUID comes from `grocery_list`;
- no optional quantity, unit, note, confidence, or metadata is invented;
- no mutation runs after an ambiguous request or uncertain mutation result;
- final wording reflects the structured result rather than claiming unobserved
  inventory facts.
