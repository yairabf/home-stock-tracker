# Hermes installation

This directory is a portable Hermes Agent skill bundle. Its generated `SKILL.md`
combines the platform-neutral tool workflow with Hermes-specific scheduled-check
rules. The NestJS service remains independent from Hermes.

Do not edit `SKILL.md` or `scenarios.md` directly. Update the canonical sources
under `integrations/shared/home-stock-tracker/`, then run
`npm run skills:generate`. Use `npm run skills:check` to detect drift.

## Prerequisite

Configure Hermes separately with a trusted MCP connection to the Home Stock
Tracker `/mcp` endpoint and confirm that these tools are discoverable:

`grocery_add`, `grocery_confirm_new_product`,
`grocery_confirm_product_alias`, `grocery_set_quantity`, `grocery_update`,
`grocery_remove`, `grocery_list`, `get_product`, `search_products`,
`get_inventory`, `list_inventory_events`, `record_purchase`,
`record_stock_signal`, `record_prediction_feedback`, `complete_grocery_purchase`, and
`get_low_stock_predictions`.

MCP endpoint configuration, authentication, and credentials do not belong in
this skill bundle. Do not store service tokens here.

## Install locally

Review `SKILL.md`, then copy this whole `home-stock-tracker` directory into the
active Hermes profile's skills directory:

```text
~/.hermes/skills/home-stock-tracker/
```

Restart or reload Hermes skills, then confirm `home-stock-tracker` appears in
the skills list. The checked-in generated bundle is the installable artifact;
repeat the review and copy when it changes.

Hermes also supports project skill discovery, external skill directories, and
GitHub/URL installation. Those deployment choices are intentionally left to the
Hermes operator rather than encoded in this repository.

## Smoke check

In a trusted test household, ask Hermes to use the skill for one read-only
request such as "What is on the grocery list?" Verify that it selects
`grocery_list` and summarizes the structured result. Test mutations only after
the MCP connection and target household are confirmed.

For a product-discovery smoke check, ask "Which milk products exist?" Hermes
should call `search_products`, present every plausible candidate in returned
order, and ask for a choice when several remain. It must not silently select a
candidate or claim that search creates, aliases, or updates anything.

For a history smoke check, ask "When did we last buy milk?" Hermes should
resolve milk with `get_product`, then call `list_inventory_events` with the
returned product ID, `eventType: "PURCHASED"`, and `limit: 1`. It should describe
the result as recorded history, not estimated current stock, and must not expose
or invent event metadata.

For an unknown-name add smoke check, ask Hermes to add a deliberately unfamiliar
product phrase. It should call `grocery_add` in proposal mode with `productName`
and nested `groceryItem`, receive `product_resolution_required` without catalog
or grocery mutation, present candidates and optional advice as non-authoritative,
and wait for the user's decision. It must not guess product facts to force
`create_if_missing`. Deterministic creation is reserved for a direct client that
deliberately supplies the complete `product` object.

Continue the smoke check by explicitly approving either complete final product
facts or one exact alias relationship. Hermes should call
`grocery_confirm_new_product` or `grocery_confirm_product_alias` with the
original grocery item and no proposal ID or source. It must not invoke the LLM
again. A cancellation makes no call. If confirmation returns
`confirmation_required`, the catalog decision stays applied while Hermes asks a
separate quantity question and does not repeat the catalog confirmation.

To review the compound flow without mutating, ask Hermes what it would do for
"I bought everything except toilet paper." It should first read the pending
list, require one exact toilet-paper match, exclude that ID, and propose one
`complete_grocery_purchase` call containing only the remaining IDs.

To review duplicate confirmation, first create a numeric pending test item, then
ask Hermes to add the same product. It should call `grocery_add` once, explain the
current quantity after `confirmation_required`, and ask for the desired final
total. An omitted new-line quantity would persist as `1`, but omitted duplicate
input remains an ambiguous `null` request echo and must not imply an increment.
After the answer, Hermes should calculate the total and call
`grocery_set_quantity` once with the item ID, final quantity, and expected old
quantity. A decline or no-change answer must make no second tool call.

For a prediction-feedback smoke check, first ask for one product estimate and
retain its non-null returned `predictionId`. Then say that the prediction was
right, wrong, or provide a concrete corrected state. Hermes should call
`record_prediction_feedback` exactly once with that trusted ID. It must ask or
make a fresh prediction read when the reference is ambiguous or the ID is null,
must keep general stock corrections on `record_stock_signal`, and must not retry
an uncertain or repeated feedback write.

## Proactive stock-check cron

Hermes owns the schedule and WhatsApp delivery. The inventory service remains a
read-only recommendation source for this workflow.

### Prerequisites

Before creating the recurring job:

1. Install or update this skill bundle in the active Hermes profile.
2. Confirm the authenticated Home Stock Tracker MCP connection exposes
   `get_low_stock_predictions` and succeeds from an interactive Hermes session.
3. Configure and test the Hermes WhatsApp home channel. The bare `whatsapp`
   delivery target resolves through that operator-owned configuration.
4. Confirm the Hermes gateway and cron scheduler are running with
   `hermes cron status`. The gateway must remain available for scheduled runs.
5. Choose the household cadence and confirm the timezone used by the Hermes
   gateway before translating it into a schedule expression.
6. Choose and pin a provider and model appropriate for unattended recurring
   work. These are cost and deployment decisions, so this repository does not
   supply defaults.

Do not put the MCP bearer token, WhatsApp credentials, recipient identifiers,
or provider credentials in this repository or in the cron prompt.

### Job prompt

Use this prompt without adding delivery instructions. Hermes cron delivers the
final response to the job's configured target:

```text
Run a scheduled proactive stock check. Follow the home-stock-tracker skill's
scheduled-check rules exactly. Call get_low_stock_predictions once. If it
returns no recommendations, respond with exactly [SILENT]. If it returns
recommendations, produce one concise household-facing message covering all of
them in the returned order. Do not mutate household state. If the tool or its
authenticated connection fails, report the failure briefly and do not retry.
```

### Create the job

Replace every angle-bracketed value. Use a schedule whose meaning you have
confirmed in the Hermes gateway's timezone:

```bash
hermes cron create "<SCHEDULE>" \
  "Run a scheduled proactive stock check. Follow the home-stock-tracker skill's scheduled-check rules exactly. Call get_low_stock_predictions once. If it returns no recommendations, respond with exactly [SILENT]. If it returns recommendations, produce one concise household-facing message covering all of them in the returned order. Do not mutate household state. If the tool or its authenticated connection fails, report the failure briefly and do not retry." \
  --skill home-stock-tracker \
  --deliver whatsapp \
  --provider "<PROVIDER>" \
  --model "<MODEL>" \
  --name "home-stock-low-stock-check"
```

The same job can be requested through Hermes chat after replacing the
placeholders: "Create a recurring `<SCHEDULE>` cron job named
`home-stock-low-stock-check`, attach the `home-stock-tracker` skill, use my
chosen provider and model, and deliver to my WhatsApp home channel. Use the
proactive stock-check prompt from the installed skill README." Review the
created job with `hermes cron list`; do not assume the natural-language request
resolved the cadence, timezone, model, or delivery target as intended.

Do not edit `~/.hermes/cron/jobs.json` directly. Use the public Hermes cron
commands so validation and scheduling metadata remain consistent.

### Verify and operate

Use the stable job name or the ID shown by `hermes cron list`:

```bash
hermes cron list
hermes cron run home-stock-low-stock-check
hermes cron runs home-stock-low-stock-check --limit 20
hermes cron pause home-stock-low-stock-check
hermes cron resume home-stock-low-stock-check
```

Run the job manually first against a non-production profile or test household.
A populated result should produce one WhatsApp-ready message. A successful empty
result should be recorded locally with `[SILENT]` and send no WhatsApp message.
A blocked configuration or MCP failure must remain visible rather than looking
like an empty recommendation result.

Revise the schedule or prompt without recreating the job:

```bash
hermes cron edit home-stock-low-stock-check --schedule "<NEW_SCHEDULE>"
hermes cron edit home-stock-low-stock-check --prompt "<REVISED_PROMPT>"
```

Pause the job before investigating repeated failures. Remove it only when the
automation is no longer wanted:

```bash
hermes cron remove home-stock-low-stock-check
```
