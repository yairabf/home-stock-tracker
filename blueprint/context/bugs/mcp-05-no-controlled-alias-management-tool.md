# Fix Brief: MCP-05 - Standalone alias administration

**Status:** Open - remaining scope only
**Priority:** P1 - data quality and language continuity

## Remaining gap

The grocery-specific alias workflow is already delivered through
`grocery_confirm_product_alias`. REST also supports standalone alias creation at
`POST /api/v1/products/:id/aliases`, backed by `ProductService.addAlias`.

MCP still has no equivalent for an explicit request to teach or maintain a
product alias outside an in-progress grocery addition.

## Required implementation

Add a standalone MCP write tool named `product_add_alias`.

### Input

```json
{
  "productId": "UUID returned by get_product or search_products",
  "alias": "whole milk"
}
```

- `productId` must be a UUID.
- `alias` must be a non-empty trimmed string.
- The tool description and agent instructions must require explicit user
  confirmation of the alias relationship before the call.

### Behavior

- Delegate the write to the existing `ProductService.addAlias` domain path.
- Return the updated canonical product using the existing MCP product response
  contract.
- Preserve same-product idempotency for canonical names and existing aliases.
- Reject aliases owned by another product with the stable
  `PRODUCT_NAME_CONFLICT` result.
- Return a safe, stable not-found result when the target product no longer
  exists.
- Never infer a target, choose among search results, invoke the LLM, or create a
  product as a side effect.

### Public contract updates

- Register `product_add_alias` in `McpServerFactory` with discoverable input and
  output schemas.
- Add the tool to the shared release contract and regenerated Hermes and
  OpenClaw tool fixtures/manifests.
- Update the API/MCP reference and both agent skills so the tool is used only
  after explicit confirmation.
- Add agent scenarios for successful teaching, same-owner retry, conflicting
  ownership, ambiguous target refusal, and a deleted target.
- Apply the repository's additive contract and skill version policy.

## Verification

- MCP factory tests prove discovery, schema validation, service delegation,
  updated-product output, and sanitized errors.
- Real MCP-client tests prove success, same-owner idempotency, cross-owner
  conflict, and deleted-target behavior.
- Contract-fixture and agent-contract checks prove that the published Hermes and
  OpenClaw bundles expose the same tool contract and safety instructions.
- Existing REST and grocery alias behavior remains green.

## Out of scope

- Product merge, alias removal, rename, or deletion.
- Automatic alias creation from search or LLM suggestions.
- Changes to `grocery_confirm_product_alias`.
- Database schema changes.
