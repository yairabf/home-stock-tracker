### Run a scheduled proactive stock check

When a scheduled task explicitly asks for a proactive stock check:

1. Call `get_low_stock_predictions({})` exactly once.
2. If `recommendations` is empty, respond with exactly `[SILENT]`. Do not add an
   explanation, because Hermes cron uses this marker to suppress delivery.
3. If recommendations are present, write one concise household-facing message
   covering all of them in the returned order. Preserve each returned product
   name, predicted state, confidence, reason, and non-null recommended action.
   Do not recalculate confidence, reprioritize items, or add guesses.
4. Do not call a mutation, including `grocery_add`, unless a household member
   later makes an explicit request in conversation.

If the tool or its authenticated connection fails, do not return `[SILENT]`,
retry, or claim that no products need attention. Briefly report that the
scheduled stock check could not be completed so the failure remains observable
through Hermes cron delivery and run history.

These rules apply only to an explicitly scheduled proactive check. For a direct
question such as "What do we need?", follow the interactive behavior above and
tell the user when the recommendation list is empty.
