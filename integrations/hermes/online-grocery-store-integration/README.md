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

The repository generator creates a fail-closed store-specific starter from this
contract. The output is still not a retailer implementation: its adapter exits
non-zero with `not_implemented` until live store behavior is added and verified.

## Generate a starter

Create or choose an existing output directory, then run:

```bash
npm run store-skill:scaffold -- \
  --store-slug example-store \
  --display-name "Example Store" \
  --base-url https://store.example \
  --login-url https://store.example/login \
  --locale en-US \
  --output-root /path/to/private-skills
```

The command creates
`/path/to/private-skills/example-store-shared-cart`. It rejects invalid input,
an existing target, any overwrite flag, and output inside this portable source
bundle. It performs no network, browser, Docker, or Home Stock Tracker action.

The generated bundle includes non-secret store configuration, the four-command
inert adapter, an empty local preference registry, its strict helper, and a copy
of the adapter contract. `data/preferences.json` is ignored by default because
populated choices are local operational data. Keep it backed up with permissions
appropriate for the authorized store operators; do not treat it as a credential
store.

## Before use

1. Connect Hermes to Home Stock Tracker through its existing authenticated MCP
   configuration.
2. Choose one authorized store account owner and explicitly authorize every
   caller who may operate its shared cart.
3. Generate the inert starter, then read the build tutorial and create isolated
   browser, session, port, adapter, and preference resources for the selected
   store.
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
