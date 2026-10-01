# Product-matching evidence

`cases.v1.json` contains 168 authored cases, not confirmed household observations.
The 28 groups contain six distinct scenarios each. Eight groups (48 cases) are
tuning; 20 groups (120 cases) are held out. Hebrew/mixed phrases total 112.
All 168 labels are pending independent review. Models did not assign the labels.

`recorded-smoke.v1.json` is an explicitly mocked full held-out replay derived
from the authored labels. Its perfect answers prove harness wiring only. It
cannot measure Jev accuracy or approve rollout. `connectivity-smoke.v1.json` is a
separate single-case live connectivity input excluded from scored evidence.

## Independent label review

Before the first held-out live run:

1. Review requested phrases, candidate facts and labels without model outputs.
   Check Hebrew translation, typo interpretation, omitted sizes, variants, brand
   identity and whether the missing product is truly absent. Units in phrases
   are identity evidence, not quantities to write.
2. Check grouping across both splits, including semantically duplicate products
   with different IDs. Automated validation detects shared groups and IDs; it
   cannot certify semantic independence. Keep synonyms and variants together.
3. Confirm that ambiguous labels name at least two plausible supplied IDs. The
   actual advisor's clarification contains all supplied candidates, including
   less-plausible alternatives; the evaluator preserves that contract.
4. A reviewer distinct from `label.author` may set `reviewStatus: reviewed`,
   `reviewer`, and ISO `reviewedAt`. Do not invent reviewer identities. Preserve
   `source: authored`; use `confirmed` only for real, independently recorded
   evidence with a non-sensitive source reference.
5. Freeze and version the reviewed corpus before exposing held-out outcomes.
   Changes alter the dataset hash and invalidate old replay files. Never correct
   labels merely to agree with model responses. Improvements selected from the
   tuning split require a fresh held-out assessment after any adapter/model/gate
   change. Do not change the shipped 0.9 gate through this script.

The initial launch assessment requires at least 50 accepted held-out matches,
98% precision, zero unsafe candidate selections on ambiguous/no-match cases,
complete reviewed live evidence, one resolved model equal to the pin, and no
provider failures. Reports show Wilson intervals and warn against interpreting
this small authored corpus as a universal household error rate. Coverage and
each language/scenario slice remain necessary operator review evidence.

See [execution and rollout](../../docs/jev-integration.md#product-matching-evaluation).
