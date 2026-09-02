## Scheduled proactive-check scenarios

These cases start from the proactive cron prompt documented in `README.md`, not
from a household member's direct question. Each successful run is independent
and may make only one read call.

<!-- EXECUTABLE_PLATFORM_SCENARIOS -->

For scheduled scenarios, also verify:

- every successful scheduled tick calls `get_low_stock_predictions` exactly once;
- populated scheduled results preserve service order and produce one message;
- only a successful empty scheduled result produces exactly `[SILENT]`;
- scheduled failures stay observable and are never retried or converted to
  silence;
- no scheduled scenario calls a mutation or invents cross-run delivery state.
