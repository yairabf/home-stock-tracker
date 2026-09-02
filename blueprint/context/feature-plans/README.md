# Queued feature plans

- [Household stock ledger and daily estimation](household-stock-ledger-plan.md) - detailed plan for build-plan item 33.

Completed plans are preserved as implemented specifications under
`blueprint/history/features/`; they are not duplicated in active context.

To queue future work:

1. Confirm that the item still belongs in `blueprint/build-plan.md`.
2. Create one reviewed plan in this directory only when it adds implementation
   detail beyond the build-plan item.
3. Load that plan through `/feature` when its dependencies are complete.
4. Remove the queued copy after `/complete` archives the implemented spec.

## Ideas that are not implementation-ready

- Merge multiple pending grocery lines.
- Rename a canonical product name.
- Remove an alias.
- Merge or delete products.
- Per-household catalogs and multi-household catalog governance.
- LLM tool calling or a two-call catalog retrieval flow.
- Typo-tolerant, trigram, vector, or semantic product search.

These are product ideas, not approved feature plans. Promote one only after a
concrete workflow justifies it.
