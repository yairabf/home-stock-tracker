# JEV classification repairs and trial release preparation

Type: Fix / bounded delivery from feature 38f
Status: verified for publication, 2026-10-09

The previous understanding prompts withheld every product-type answer and many
correct category answers in the synthetic diagnostic. Explicit type/category
question definitions and target-safe metadata now produce adapter v4 behavior.
Thresholds, public contracts and other task routing remain unchanged. Diagnostics
retain validation failures, preserve references and include recorded-response replay.

The optional private collector saves exact inputs before inference in the existing
log table, defaults off and does not block classification on persistence failure.
Both local and published-image Compose files forward task selectors, advice flag,
optional TypeSafe key/model and capture flag. Missing TypeSafe settings remain
unset for OpenAI-only installations. Env values must be forwarded by the server's
Compose file; pulling an image alone does not update that file or container env.

The server-agent guide covers env-file handling, exact adapter/image checks,
digest pinning, existing project/volume preservation, migration/recreation,
readiness, ordinary-use review and selector rollback. The operator explicitly
approved commit, merge, push and publication in this chat. This delivery does not
install or restart a production backend and does not enable JEV by default.

## Verification

- npm run verify: 129 suites, 1988 tests, production build passed.
- npm run contract:check: 6 suites, 79 tests, 124 scenarios passed.
- npm run test:e2e -- --runInBand test/app.e2e-spec.ts test/service-auth.e2e-spec.ts:
  2 suites, 7 tests passed.
- Real Docker Compose config checks with isolated synthetic env files: both
  Compose files passed absent optional credentials/default OpenAI and supplied
  JEV settings/capture enablement. No secrets were printed and no containers ran.
- Graphify AST update: 6477 nodes, 423 communities. Diff check passed.
- Full PostgreSQL-backed E2E remains unverified: databases unavailable and isolated
  EVALUATION_DATABASE_URL absent; prior full attempt stopped, not called passing.

## Evidence and remaining scope

The latest 240-case synthetic comparison accepted correct category answers on
219/224 answerable targets, type on 205/224, unit on 215/224 and perishability on
205/206. All scored accepted answers matched authored references. These are
synthetic tuning diagnostics, not independently reviewed real-world truth.
Private provider artifacts and real household exports are not committed.

Formal 38f held-out/historical qualification and 38g validated rollout remain
pending. The completed source repairs are published separately for the operator's
limited product-classification trial; incomplete evidence requirements are not
marked complete. Rollback changes PRODUCT_UNDERSTANDING_PROVIDER to openai and
recreates app, without undoing previously saved data.

Manual try/deploy: docs/jev-product-classification-trial.md.
