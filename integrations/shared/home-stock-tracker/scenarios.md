# Home Stock Tracker skill scenarios

Use this matrix to review the skill against representative grocery and inventory
conversations. Arguments shown as `<resolved product id>`, `<listed item id>`,
or `<active prediction id>` must come from the active or immediately preceding
tool result, never from the model.

<!-- EXECUTABLE_GROCERY_CATALOG_SCENARIOS -->

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
- household context is read only for an explicit setup, configuration, or
  explanation question, never as a prerequisite for a routine prediction or
  recommendation;
- household context values are preserved without invention or mutation, and a
  missing configuration remains an operator setup result;
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

<!-- PLATFORM_SCENARIOS -->
