# Home Stock Tracker skill scenarios

Use this matrix to review the skill against representative grocery and inventory
conversations. Arguments shown as `<resolved product id>`, `<listed item id>`,
or `<active prediction id>` must come from the active or immediately preceding
tool result, never from the model.

| Case | User request or condition | Expected action | Expected outcome |
| --- | --- | --- | --- |
| Add grocery item | "Add two liters of milk," and the name resolves exactly. | `grocery_add({ productName: "milk", groceryItem: { requestedQuantity: 2, unit: "liters" } })` in default proposal mode. | Summarize `createdItem` with its positive persisted quantity. |
| Omitted new-line quantity | "Add milk," no pending line exists for an exactly resolved product. | `grocery_add({ productName: "milk", groceryItem: {} })` in default proposal mode. | The created line has persisted `requestedQuantity: 1`. |
| Unknown product proposal | "Add za'atar yogurt," and the phrase has no exact match. | `grocery_add({ productName: "za'atar yogurt", groceryItem: {} })`; present `product_resolution_required` candidates, optional advice, and allowed actions. | No catalog or grocery mutation occurs before a new user decision. |
| Proposal is non-authoritative | `product_resolution_required.proposal` recommends an alias or creation. | Explain the advice and server-computed actions, but do not select or apply an action. | Provider output never authorizes a write. |
| Candidate choice | Resolution returns several candidates. | Present plausible candidates in returned order and ask the user to choose, create, or cancel. | No product identity is guessed. |
| Standalone product alias | The user explicitly confirms that "whole milk" identifies one exact resolved milk product outside a grocery request. | `product_add_alias({ productId: <trusted product id>, alias: "whole milk" })` once, with no source or proposal state. | Return the updated canonical product and aliases without changing groceries or invoking the LLM. |
| Standalone alias with ambiguous target | Several milk products could own the requested alias. | Present every plausible candidate in returned order and ask the user to choose and confirm the relationship. | Do not call `product_add_alias` until one exact product ID is selected. |
| Standalone alias ownership conflict | The confirmed alias already belongs to another canonical product. | Report `PRODUCT_NAME_CONFLICT` as final for this decision. | Do not select another owner, overwrite the alias, or retry automatically. |
| Standalone alias target was deleted | The exact confirmed product ID no longer exists when the alias write runs. | Report the safe not-found result as final for this decision. | Do not search for a replacement owner or retry automatically. |
| Standalone alias transport uncertainty | The alias call ends without a reliable result. | Stop and report uncertainty; use a fresh read before asking about another write. | Do not retry automatically or claim that the alias was saved. |
| Confirmed product creation | The user approves complete final facts for a proposed new product. | `grocery_confirm_new_product({ product: <approved final facts>, groceryItem: <original grocery item> })`; send no proposal ID or source and make no second LLM request. | Product and first grocery line commit atomically, or a stable conflict is returned. |
| Confirmed product alias | The user confirms that "three percent milk" is an alias for one exact returned candidate. | `grocery_confirm_product_alias({ targetProductId: <chosen product id>, alias: "three percent milk", groceryItem: <original grocery item> })`. | The alias and new grocery line commit through one shared use case. |
| Confirmed alias with quantity ambiguity | Alias confirmation finds an existing pending line with quantity 2. | Keep the successful alias, explain `confirmation_required`, and ask for the final grocery quantity. Do not repeat the alias confirmation. | Catalog identity is saved while the existing grocery quantity remains 2. |
| Confirmed relative quantity | Alias confirmation requested 1, found quantity 2, and the user says "add that one." | Calculate final quantity 3, then call `grocery_set_quantity` with the exact line ID and `expectedRequestedQuantity: 2`. | Quantity changes separately to 3; no catalog confirmation is repeated. |
| Stale confirmed catalog decision | Confirmation returns `PRODUCT_NAME_CONFLICT` or `PRODUCT_NOT_FOUND`. | Explain that the catalog changed and ask for a fresh choice. Do not retry, regenerate a proposal, or choose another target. | The stale decision causes no implicit grocery or catalog mutation. |
| Resolution cancellation | The user cancels after `product_resolution_required`. | Call no tool and confirm cancellation. | Catalog and grocery state remain unchanged. |
| Deterministic direct creation | A direct client deliberately has every required product fact. | Use explicit `create_if_missing` with complete `product` and nested `groceryItem`; do not invoke proposal mode. | Product and first grocery line commit atomically, or neither does. |
| Duplicate cancellation | "Add one milk," and `grocery_add` returns one existing line with quantity 2; the user chooses no change. | Explain that 2 are already pending, ask for the desired final total, then call no tool after the decline. | No quantity or row changes. |
| Duplicate with final quantity | "Add one milk," and `grocery_add` returns one existing line with quantity 2; the user says to add one more. | Calculate the final total as 3, then call `grocery_set_quantity({ itemId: <existing item id>, requestedQuantity: 3, expectedRequestedQuantity: 2 })`. | The existing line becomes quantity 3; no separate row is created. |
| Duplicate with larger addition | "Add two milk," and `grocery_add` returns one existing line with quantity 2; the user says to add both. | Calculate the final total as 4, then call `grocery_set_quantity({ itemId: <existing item id>, requestedQuantity: 4, expectedRequestedQuantity: 2 })`. | The existing line becomes quantity 4; no service-side arithmetic or separate row is used. |
| Missing requested quantity | "Add milk," and `grocery_add` returns `requestedAddition.requestedQuantity: null` with an existing line. | Treat omission as ambiguous, not an increment. Explain the current positive quantity and ask for the desired final total or cancellation. | No mutation occurs before a final quantity is supplied. |
| Multiple duplicate lines | `grocery_add` returns two `existingItems`. | Describe the distinguishing returned fields and ask which line to update. | Do not choose an ID or mutate until the user selects one. |
| Conflicting duplicate units | The requested addition uses liters while the existing line uses cartons. | Explain the mismatch and ask for a compatible quantity and unit. Do not convert or mutate. | No quantity is guessed or converted. |
| Quantity plus note update | The user confirms both a final quantity and a new note for one exact line. | Call `grocery_update` once with the final quantity, note, and both exact expected old values. | Both selected fields change atomically; quantity-only guidance is not used. |
| Explicit separate line | "Add milk as a separate line." | `grocery_add({ productName: "milk", groceryItem: { ifPendingExists: "create_separate" } })` | One intentional additional pending row is created, defaulting quantity to 1 if omitted. |
| Stale quantity decision | `grocery_set_quantity` returns `GROCERY_ITEM_CHANGED` with current state. | Show the changed state and ask for a fresh decision. Do not retry or recalculate. | The stale confirmation causes no additional mutation. |
| Quantity update transport uncertainty | `grocery_set_quantity` ends without a reliable result. | Stop and report uncertainty. Do not retry `grocery_set_quantity` or fall back to another mutation. | A possible duplicate mutation is avoided. |
| Invalid grocery quantity | "Add minus two milks." | Ask for a valid positive quantity. Do not call a tool. | No mutation occurs. |
| Add several grocery items | "Add milk and eggs." | Call `grocery_add({ productName: "milk", groceryItem: {} })`, then `grocery_add({ productName: "eggs", groceryItem: {} })`. | Summarize both confirmed additions in the user's order. |
| Item-specific measurements | "Add two liters of milk and eggs." | Call `grocery_add({ productName: "milk", groceryItem: { requestedQuantity: 2, unit: "liters" } })`, then `grocery_add({ productName: "eggs", groceryItem: {} })`. | Do not copy milk's quantity or unit to eggs. |
| Multi-add uncertain failure | The milk addition is confirmed, but the eggs mutation has an uncertain transport result. | Stop after the eggs result. Do not retry or attempt later additions. | Report milk as confirmed and eggs as uncertain. |
| List groceries | "What's on the grocery list?" | `grocery_list({})` | Summarize pending items. |
| Empty grocery list | `grocery_list` returns `{ items: [] }`. | Do not call another tool. | Say the pending grocery list is empty. |
| Remove one grocery item | "Remove milk from the list." | `grocery_list({})`, select one exact pending `productName`, then `grocery_remove({ id: <listed item id> })`. | Summarize the removed item. |
| Ambiguous grocery removal | Two pending items exactly match the requested name. | Ask which item to remove. Do not call `grocery_remove`. | No mutation occurs. |
| Product lookup | "Which product is whole milk?" | `get_product({ productName: "whole milk" })` | Summarize the canonical product and aliases. |
| Product lookup by known ID | The active context already contains a trusted product UUID and the user asks for that product. | `get_product({ id: <known product id> })` | Summarize the returned product. |
| Exact product search | "Find the product called whole milk." | `search_products({ query: "whole milk" })`; if `exactMatch` is present, present that exact identity. | No LLM or mutation is invoked. |
| One nearby product candidate | Exact lookup fails and `search_products({ query: "oat" })` returns one candidate. | Present the candidate and ask whether it is the intended product before any mutation. | No candidate is silently selected. |
| Multiple product candidates | `search_products({ query: "milk" })` returns several candidates. | List every candidate in returned order and ask the user to choose one. Do not call a mutation yet. | The user, not the agent, selects the identity. |
| Unknown product | `search_products({ query: "unknown phrase" })` returns no exact match or candidates. | Ask for another name or more detail. Do not call a write tool. | No product is created. |
| Prediction-disabled discovery | Search returns a product with `predictionEnabled: false`. | Present it as a valid catalog identity and preserve the metadata. | Search does not hide or enable the product. |
| Search is read-only | A search result or future advisory proposal recommends an identity action. | Explain that it is advice only. Do not create a product, add an alias, or treat it as authorization for a write. | Catalog, grocery, and inventory state remain unchanged. |
| Inventory estimate | "Did we probably run out of milk?" | `get_product({ productName: "milk" })`, then `get_inventory({ id: <resolved product id> })`. | State the returned predicted state, confidence, and reason without inventing a count. |
| Uncertain inventory | `get_inventory` returns `predictedState: "uncertain"`. | Do not call `grocery_add` or record a stock event. | Explain that there is not enough confidence to tell. |
| Named product history | "What has been recorded about milk?" | `get_product({ productName: "milk" })`, then `list_inventory_events({ productId: <resolved product id> })`. | Summarize returned events newest first as recorded history, not current stock. |
| Filtered purchase history | "When did we last buy milk?" | `get_product({ productName: "milk" })`, then `list_inventory_events({ productId: <resolved product id>, eventType: "PURCHASED", limit: 1 })`. | Report the newest matching timestamp without claiming what remains now. |
| Empty inventory history | `list_inventory_events` returns `{ items: [], total: 0, limit: 20, offset: 0 }`. | Do not call another inventory tool or mutation unless the user separately asks about current stock or requests a write. | Say there are no matching recorded events, not that the product is out or unavailable. |
| Inventory history pagination | The first history page returns `total: 45`, `limit: 20`, `offset: 0`, and the user asks for more. | Call `list_inventory_events` again with the same filters, `limit: 20`, and `offset: 20`; preserve newest-first page order. | Present the next page and do not claim completeness while more results remain. |
| Correction history review | "Before I correct the milk record, what did I previously tell you?" | Resolve milk, call `list_inventory_events({ productId: <resolved product id> })`, summarize the events, and wait for an explicit correction decision. | No correction or other mutation is recorded from the review request alone. |
| Purchase | "I bought three cartons of milk." | `get_product({ productName: "milk" })`, then `record_purchase({ productId: <resolved product id>, eventType: "PURCHASED", quantity: 3, unit: "cartons" })`. | Summarize the recorded purchase. |
| Explicit restock | "I restocked rice." | `get_product({ productName: "rice" })`, then `record_purchase({ productId: <resolved product id>, eventType: "RESTOCKED" })`. | Summarize the recorded restock without adding a quantity. |
| Future purchase | "I'll buy milk tomorrow." | Do not call `record_purchase`. | Treat it as a plan, not a completed event. |
| Low stock signal | "We're almost out of cereal." | `get_product({ productName: "cereal" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_LOW" })`. | Summarize the recorded low-stock observation. |
| Out-of-stock signal | "There is no rice left." | `get_product({ productName: "rice" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_OUT" })`. | Summarize the recorded out-of-stock observation. |
| Available-stock signal | "We still have plenty of rice." | `get_product({ productName: "rice" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_CONFIRMED" })`. | Summarize the availability confirmation. |
| General stock correction | "Correction to my earlier stock report: we do still have milk," with no prediction referenced. | `get_product({ productName: "milk" })`, then `record_stock_signal({ productId: <resolved product id>, eventType: "STOCK_CORRECTED" })`. | Record one general stock correction without prediction feedback. |
| Accepted prediction feedback | After one active prediction, the user says, "Yes, that was right." | `record_prediction_feedback({ predictionId: <active prediction id>, outcome: "accepted" })`. | Mark only that prediction accepted. |
| Rejected prediction feedback | After one active prediction, the user says, "No, that prediction was wrong," without a corrected state. | `record_prediction_feedback({ predictionId: <active prediction id>, outcome: "rejected" })`. | Mark only that prediction rejected. |
| Corrected prediction feedback | After a milk prediction, the user says, "No, we still have milk." | `record_prediction_feedback({ predictionId: <active prediction id>, outcome: "corrected", correctedState: "likely_available" })`; do not call `record_stock_signal`. | Reject the prediction and record one linked stock correction in the same operation. |
| Ambiguous prediction feedback | Several predictions are active and the user says, "That was wrong." | Ask which prediction they mean. Do not call a mutation. | No prediction ID or outcome is guessed. |
| Null prediction ID | The referenced prediction read returned `predictionId: null`. | Make a fresh prediction read when the product is known, or explain that feedback cannot yet be attached. Do not mutate with a guessed ID. | Feedback waits for one non-null trusted prediction ID. |
| Repeated prediction feedback | `record_prediction_feedback` returns `Prediction feedback was already recorded`. | Treat the conflict as final. Do not retry or switch the outcome. | No duplicate event is created. |
| Prediction feedback transport uncertainty | `record_prediction_feedback` ends without a reliable result. | Stop and report uncertainty. Do not retry or fall back to `record_stock_signal`. | A possible duplicate feedback event is avoided. |
| Ambiguous stock wording | "Milk situation changed." | Ask whether milk is low, out, available, or correcting an earlier record. Do not call a write tool. | No event type is guessed. |
| Low-stock recommendations | "What do we need?" | `get_low_stock_predictions({})` | Report only returned recommendations. |
| Empty recommendations | `get_low_stock_predictions` returns `{ recommendations: [] }`. | Do not add products or call another prediction tool. | Say there are no actionable recommendations now. |
| Domain failure | A mutation returns a validation or not-found tool error. | Report the safe error and correct only from known facts or ask a focused question. | Do not claim success. |
| Uncertain transport failure | A mutation call ends without a reliable result. | Report that the outcome is uncertain. Do not retry automatically. | Avoid a possible duplicate mutation. |
| Complete everything | "I bought everything." | `grocery_list({})`, then `complete_grocery_purchase({ items: [{ groceryItemId: <returned id> }, ...] })` for all pending items. Do not copy requested quantities or units. | Summarize only the completed items returned by the mutation. |
| Complete selected items | "I bought milk and eggs." | `grocery_list({})`; require one exact pending match for each name; call `complete_grocery_purchase` once with preferred `items` in user order. | Unmentioned pending items remain pending. |
| Complete with actual measurement | "I bought two cartons of milk." | `grocery_list({})`; resolve one exact pending milk row; call `complete_grocery_purchase({ items: [{ groceryItemId: <returned id>, actualQuantity: 2, actualUnit: "cartons" }] })`. | The purchase event records the explicit actual measurement. |
| Complete without actual measurement | "I bought the milk." | Call the preferred form with `items: [{ groceryItemId: <returned id> }]`. Do not copy its requested quantity, requested unit, or typical unit. | The purchase event omits quantity and unit. |
| Duplicate product measured consistently | Two selected milk rows were actually bought as two and three cartons. | Send both preferred item objects with their explicit actual quantities and exact `cartons` unit in one call. | The service records one five-carton purchase event for milk. |
| Duplicate product measurement ambiguity | Two selected milk rows exist, but only one actual quantity is known or their actual units conflict. | Ask a focused question for compatible actual facts, or proceed only after the user chooses to omit measurements from every row. Do not mutate yet and never convert units. | No partial or conflicting measurement is guessed. |
| Complete everything except one item | "I bought everything except toilet paper." | `grocery_list({})`; require one exact `productName` match for toilet paper; call `complete_grocery_purchase` once with preferred `items` for every other pending row. | Toilet paper remains pending; summarize confirmed completed items. |
| Complete everything except several items | "I bought everything except toilet paper and milk." | `grocery_list({})`; require one exact pending match for each exception; call `complete_grocery_purchase` once with preferred `items` for all remaining rows. | Both named exceptions remain pending. |
| Empty list completion | "I bought everything," then `grocery_list` returns no pending items. | Do not call `complete_grocery_purchase`. | Say the pending list was already empty. |
| Unmatched purchase name | "I bought everything except oat milk," but no pending `productName` is exactly `oat milk`. | Ask which pending item the user means. Do not mutate. | No item is guessed or completed. |
| Duplicate pending name | "I bought everything except milk," but two pending items have `productName: "milk"`. | Ask which milk item should remain pending. Do not mutate. | No arbitrary duplicate is selected. |
| All items omitted | Every pending item is named as an exception. | Do not call `complete_grocery_purchase`. | Explain that nothing was recorded as purchased. |
| List changes before completion | `complete_grocery_purchase` rejects because a selected item is no longer pending. | Read `grocery_list` again, explain the changed snapshot, and ask for fresh confirmation. | Do not retry the mutation automatically. |
| Compound domain failure | `complete_grocery_purchase` returns a validation or not-found tool error. | Report the safe error and do not claim any item was completed. | The all-or-nothing service leaves the batch uncommitted. |
| Compound uncertain failure | `complete_grocery_purchase` ends without a reliable result. | Report that the entire outcome is uncertain. Do not retry or issue per-item mutations. | Avoid duplicate purchase events and item completion. |

## Review record

For each row, verify:

- the selected tool exists in the MCP registry;
- every argument name and enum value matches its schema;
- every product UUID comes from `get_product`, trusted active context, or a
  `search_products` result that the user explicitly chose when multiple candidates existed;
- every grocery-item UUID comes from `grocery_list`;
- every prediction UUID comes from the active interaction or a fresh
  `get_inventory` or `get_low_stock_predictions` result and is non-null;
- `complete_grocery_purchase` receives a non-empty, unique, inclusive preferred
  `items` list; legacy `groceryItemIds` is transitional and is never emitted by
  a new agent call;
- omitted items never appear in `complete_grocery_purchase` arguments;
- actual purchase quantity and unit come only from explicit user facts and are
  never copied from requested or typical values;
- duplicate-product actual measurements are complete with exactly matching
  trimmed units, or the agent asks before mutation and never converts units;
- no optional quantity, unit, note, confidence, or metadata is invented;
- every named history lookup resolves a product ID before
  `list_inventory_events`;
- history pagination preserves filters and advances `offset` by the prior
  `limit` without gaps or repeats;
- history responses are described as recorded events, never as estimated
  current stock, and omitted metadata is never reconstructed;
- history review alone never triggers a correction or another mutation;
- uncertain names begin with `propose_if_missing`, whether explicit or through
  the MCP default, and always include nested `groceryItem`;
- `product_resolution_required` never causes a product, alias, or grocery write;
- proposal advice remains non-authoritative and every product choice comes from
  the user;
- standalone alias writes use one exact trusted product ID and explicit user
  confirmation, never an inferred or merely suggested relationship;
- confirmed create and alias calls contain only the final approved payload and
  original grocery item, never proposal state or client-owned source;
- confirmation never invokes the LLM again or auto-retries a stale catalog result;
- `confirmation_required` after catalog confirmation preserves the catalog write
  and moves quantity handling to the separate quantity workflow;
- `create_if_missing` is used only with complete, deliberate product facts;
- every persisted grocery quantity is finite, positive, and non-null;
- no mutation runs after an ambiguous request or uncertain mutation result;
- specific prediction corrections use one `record_prediction_feedback` call
  and never a second `record_stock_signal` call;
- general stock corrections without a prediction reference stay on
  `record_stock_signal`;
- every `confirmation_required` add waits for a user answer before another mutation;
- omitted duplicate input is ambiguity, never an increment;
- a quantity-only duplicate uses `grocery_set_quantity`, not `grocery_update` or `create_separate`;
- `grocery_update` remains the one-call operation for intentional multi-field changes;
- the agent calculates the final quantity from the selected line and the user's answer;
- no tool is called when the chosen final quantity is unchanged;
- every selected update field has its expected old value from the existing item;
- final wording reflects the structured result rather than claiming unobserved
  inventory facts.
