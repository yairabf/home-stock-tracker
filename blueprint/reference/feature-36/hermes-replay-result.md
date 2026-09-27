# Hermes isolated replay result

Evidence supplied by the user on 2026-09-28 from a temporary Hermes profile.
This records reported execution and pasted tool records, not direct access by
the repository agent to the remote runtime.

## Observed recovery

- Isolated MCP endpoint: `http://127.0.0.1:14301/mcp`; separate PostgreSQL on
  `127.0.0.1:15433`. Fresh credentials; scheduled stock workflows disabled.
- Hermes discovered 24 tools. Pasted live confirmation description matches the
  new native-type and bounded-correction guidance. Earlier user evidence verified
  loaded skill 1.17.1 and manifest MCP description contract 1.7.1.
- Initially zero products, product names, and grocery items.
- Rejected confirmation contained `requestedQuantity: "1"`,
  `isPerishable: "false"`, and `aliases: {"item":"תערובת גריל עוף"}`.
- Actual Hermes bridge returned: `tool_call to
  'mcp__home_stock_tracker__grocery_confirm_new_product' failed argument
  validation at arguments.product.isPerishable (type): 'false' is not of type
  'boolean'. The tool was NOT invoked.` Grocery read-back remained empty.
- Exactly one corrected confirmation used quantity `1`, boolean `false`, and
  aliases `["תערובת גריל עוף"]`, preserving seasoning name, category, bag unit,
  and pantry-staple product type. Returned `outcome: created`.
- Read-back showed one pending grocery item, quantity 1, unit `שקית`, canonical
  name `תבלין גריל עוף`, and approved alias. Final reported counts: one product,
  two names, one grocery item.
- Created product ID: `001bd0bb-fd1c-4df2-8392-5ffbb8b78af9`; grocery item ID:
  `9b2fa25a-4049-4c4c-aac5-68a9fe273365`; creation time:
  `2026-09-27T21:11:23.920Z`.
- User reports production remained on its pinned digest and healthy. Test
  containers, volume, network, local image, temporary profile, and credentials
  removed; test ports closed.

## Coverage limits

This passes the reported malformed-to-corrected bridge recovery path. The
database started empty, so preserving an earlier successful addition was not
exercised. Missing facts/approval, a second validation failure, uncertain
execution, and policy mismatch were not exercised in this replay. Pasted records
contain calls/results but not model reasoning, approval messages, Hermes/model
versions, pinned image digest, or a session ID; they do not independently prove
that the model chose the correction without test orchestration. Local regression
and scenario tests cover separate safety properties. Do not label all Step 5
acceptance criteria satisfied on this evidence alone.
