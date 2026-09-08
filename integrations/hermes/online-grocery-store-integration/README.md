# Online grocery store integration scaffold

This portable documentation bundle helps build a separate, isolated skill for a
future online grocery store. It does not implement a retailer, provide browser
automation, or run inside Home Stock Tracker.

## What it provides

- An agent-facing operating guide in [SKILL.md](SKILL.md).
- A secure setup and promotion guide in
  [references/build-tutorial.md](references/build-tutorial.md).
- A load-bearing vendor-adapter contract in
  [references/adapter-contract.md](references/adapter-contract.md).

Feature 34b will add a fail-closed generator that creates a store-specific
starter bundle from this contract. Until then, this directory is documentation
only.

## Before use

1. Connect Hermes to Home Stock Tracker through its existing authenticated MCP
   configuration.
2. Choose one authorized store account owner and explicitly authorize every
   caller who may operate its shared cart.
3. Read the build tutorial and create isolated browser, session, port, adapter,
   and preference resources for the selected store.
4. Complete read-only discovery before enabling any cart mutation.

Never store service tokens, store credentials, browser state, OTPs, product
preferences, selectors, account details, or a real vendor configuration in this
portable bundle.

## Relationship to Home Stock Tracker

The existing `home-stock-tracker` skill reads and changes household state. A
store skill can read its pending grocery list and ensure approved products are
in a vendor cart. It must leave every line pending until a real purchase is
reported through the normal Home Stock Tracker purchase flow.

Use this bundle as a design and safety contract. See the linked references for
the complete operational requirements.
