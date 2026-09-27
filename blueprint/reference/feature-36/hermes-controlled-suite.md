# Hermes controlled conversation suite

User-supplied evidence assessed 2026-09-28. Session
`20260927_213902_3e819e`, real Hermes CLI conversation resumed across cases;
model `gpt-6-luna`, provider `openai-codex`, Hermes `0.21.4 (2026.9.21)` upstream
`5f47c35d`. Capture timestamp `2026-09-27T21:57:33.881091+00:00`.

## Environment and method

Disposable compose project `hst-recovery-7bd9da`; pinned image
`ghcr.io/yairabf/home-stock-tracker@sha256:304753f8aa7d135d3df4775391cc300cca9a5c51a0dd5428e196d354a779cc35`.
App localhost port 18401, PostgreSQL port 19433, separate volume and credentials,
stock workflows disabled. Initial database counts 0 products / 0 names / 0
grocery items. Live discovery initially returned 24 tools. The controlled profile
then exposed read-only grocery_list plus a custom disposable SDK harness.

Harness tool `mcp__hst_test_harness__attempt_confirmation` accepted nested
arguments and injected deterministic pre-dispatch NOT-invoked errors. It
forwarded valid confirmations to the isolated application. The timeout test
forwarded a valid write, suppressed its successful response, and reported an
uncertain result. These are injected failures, not Hermes native validation or
a real network timeout. Prompts explicitly prescribed the correction and stop
behavior; this demonstrates controlled instruction-following, not autonomous
recovery from an ordinary household request.

## Results supported by pasted conversation and harness events

| Case | Calls, dispatch, and state | Assessment |
| --- | --- | --- |
| Malformed confirmation recovery | One malformed harness call rejected with dispatched=false; one corrected call dispatched and created quantity 1. Existing baseline ID fe91e9ac-250d-4b02-a134-4eb873062ef0 retained quantity 2 and unit unit. Neither earlier successful product was written again. | Passed under injected validation. |
| Missing facts | One harness call rejected for aliases, typicalUnit, isPerishable. Agent asked for those values. Identical three-row grocery read-back; no mutation dispatch. | Passed under injected validation. |
| Corrected attempt also invalid | Two harness calls, both rejected; second deliberately used __invalid_test_type__. No third attempt, direct mutation, or backend dispatch. | Passed under injected validation. |
| Uncertain result | One harness call dispatched once; successful backend response suppressed. Agent read state and reported uncertainty without retry. New row 6ebe537f-c3bd-4cbc-aead-9cc2f9a8d4e5 was present. | Passed under simulated post-commit timeout. |

The missing-facts turn first tried batching two local calls; Hermes rejected the
batch. Separate read and harness calls followed. This bridge-format rejection
was not a backend mutation or a confirmation correction attempt.

## Excluded claim and remaining limits

Earlier direct-tool turn confirmed baseline and another recovery fixture using
valid arguments, but its final response claimed a malformed rejection with no
matching tool event. Exclude that claimed rejection from recovery evidence.
The user caught it and repeated the case with the logged harness. Four final
rows comprise baseline, the extra earlier valid fixture, controlled recovery,
and timeout fixture; reported final counts 4 products / 8 names / 4 groceries
are consistent with those writes, not two recovery dispatches in the harness
case. The extra row existed only in the disposable database.

No Hermes runtime serializer repair is established. Native validator behavior
and unprompted skill-driven recovery are not established by this controlled
suite. The prior bridge-level trace remains separate evidence, not a substitute
for this method distinction. No additional service defect is identified here.

## Production and cleanup (reported)

Production retained its app and PostgreSQL image IDs, running/healthy status, and
database counts 49 / 52 / 13 before and after. User reports successful compose
down with volumes/remove-orphans, no containers/volume/network remaining, ports
18401 and 19433 free, temporary profile/credentials/auth copy removed, and local
test image removed. Repository agent did not directly inspect remote runtime.

## Conclusion

The four requested controlled cases have evidence, alongside passing local
strict-schema, persistence, scenario, contract, and build checks. Ready for
feature completion review with the injection and prompting limits retained in
the archive; do not describe this as guaranteed autonomous Hermes recovery.
