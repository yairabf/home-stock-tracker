# Feature 36: user-supplied Hermes capture

Source: default-profile WhatsApp session history, messages 13163-13164.
Client: Hermes. Installed version and session identifier not supplied.
Arguments: `hermes-failed-tool-call.json`, copied from the supplied capture.
This is the attempted client tool call, not a request received by the MCP service.

## Raw error excerpt (verbatim)

```text
tool_call to 'mcp__home_stock_tracker__grocery_confirm_new_product' failed argument validation at arguments.product.isPerishable (type): 'false' is not of type 'boolean'. The tool was NOT invoked.
```

The complete error supplied in chat includes the validation schema. Its relevant
field definitions agree with repository contract 1.7.0:

| Field | Captured value | Advertised requirement |
| --- | --- | --- |
| product.isPerishable | "false" (string) | boolean |
| groceryItem.requestedQuantity | "1" (string) | number, greater than zero |
| product.aliases | {"item": "תערובת גריל עוף"} | array of nonempty strings |

## Established and unresolved

- Hermes reports rejection before tool invocation. This failed confirmation did
  not reach the MCP service according to the supplied client error.
- No service change can repair this pre-invocation rejection while retaining the
  existing strict schema.
- The payload is malformed at Hermes's validation boundary. No original model
  output or before/after serialization capture was supplied, so the first
  type-changing boundary remains unproven.
- Approved final payload, Hermes version, installed skill version, model/provider,
  and actual argument constructor/serializer source are not yet known.
- The earlier successful operation and any prior state changes were not captured.
  Do not replay this mutation blindly or assume the grocery list is unchanged.
- Correct shape for these three fields, only if these are the approved facts:
  isPerishable: false; requestedQuantity: 1; aliases: ["תערובת גריל עוף"].
  This shape correction is not authorization to invoke the tool.

## Additional user-supplied evidence

- First session: `@session:default/20260916_190020_c4fb4d5a`.
- Captured `grocery_add` arguments: `hermes-failed-grocery-add.json`.
- Returned error: `Product input must match unknownProductPolicy`.
- The request selected `create_if_missing` while supplying only `productName`,
  not complete `product` facts. Existing instructions already require complete
  approved product facts for that policy; the request violates that contract.
- Second session: `@session:default/20260918_092330_923e2739`, September 18.
  Fabric-softener addition reportedly used string "1" for requestedQuantity and
  was rejected before service invocation. Full arguments/error not supplied.
- These references identify history records but are not filesystem paths or
  callable session resources available in this repository.
- No evidence supplied demonstrates a correctly typed argument being converted
  by a serializer. Treat this as observed malformed client construction, with
  the generation-versus-transformation distinction still unresolved.

## Repository guidance scope (approved; not yet implemented)

- Add a complete, correctly typed JSON confirmation example to the authoritative
  shared workflow: boolean false, numeric quantity, and aliases as a string array.
- Explicitly require schema checks before dispatch: preserve primitive types and
  array shape; do not wrap aliases in an item object or stringify values.
- Explicitly prohibit create_if_missing with productName alone. Ordinary names
  use proposal mode; complete approved facts use the existing confirmation tool.
- Add independent wrong-type and aliases-object transport regressions, keeping
  strict server schemas unchanged. Generate both platform bundles from source.
- Verify guidance in the same Hermes sessions or equivalent isolated replay.
  Prompt guidance and server tests cannot establish a repaired external serializer.

User approved revising the feature to MCP descriptions and generated skills,
including bounded recovery in the same conversation after explicit non-invocation.
The current spec supersedes the earlier requirement to locate an external
serializer before repository guidance work. Actual Hermes replay remains required.
