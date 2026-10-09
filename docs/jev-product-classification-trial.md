# JEV product-classification trial: server-agent guide

Prepared 2026-10-09. Give this entire guide to the agent administering the existing
Home Stock Tracker Docker installation. The operator requested preparation of this
runbook; this document itself does not perform or report a deployment.

## What we are enabling

Use JEV only for product category, product type, typical unit and perishability.
Keep matching, shelf-life and stock advisors on OpenAI, and workflow advice disabled.
Preserve the existing service token, database, ports, MCP access, scheduler and
confirmation rules. Preserve existing metadata; do not reclassify the catalog.
The unchanged acceptance gate requires both confidence and selected probability
of at least 0.9. Uncertainty/failure abstains, without automatic OpenAI fallback
for understanding. Keep OpenAI credentials because other tasks still use them.

This is a limited trial supported by synthetic diagnostics, not proof that the
formal real-world launch gates passed. The repaired adapter accepted correct
category answers on 219/224 answerable synthetic targets and type on 205/224.
All scored accepted answers matched authored references. Labels were not
independently reviewed real-world truth. Review normal household results and
revert if incorrect accepted classifications cause problems.

## Important image prerequisite

The release must contain the tested product-type/category repairs and adapter
version `jev-product-understanding-v4`. This delivery includes the repaired
question builders, optional input capture and Compose forwarding. Confirm the
GitHub publishing workflow for the delivered main revision succeeds before
pulling `latest`; an older cached image will not contain those changes.

Do not enable JEV on an older image. The image check below must report v4.
Optional capture also requires its capture service in the image.

The registry is `ghcr.io/yairabf/home-stock-tracker`. CI publishes `sha-<full SHA>`
and promotes current passing main to `latest`. Pull the intended image, verify
its revision and adapter below, then pin its actual digest. Both app and
migration services must use that same digest. Obtain a specific published SHA
from the maintainer if latest has moved since this guide was prepared.

## 1. Inspect the existing installation and save rollback information

Work in the existing deployment directory. Locate the actual Compose file,
service names, environment file and Compose project name. The commands below
assume `docker-compose.release.yml`, `docker-compose.env`, and services named
`app`, `migrate`, `postgres`. Adapt those names to the real installation before
running anything. Preserve the existing project name and named PostgreSQL volume.
If the installation uses an external database, retain its existing DATABASE_URL;
do not introduce a new postgres service or replace it with the example URL.

Use this shell function throughout the same session:

```sh
jev_compose() {
  docker compose --env-file ./docker-compose.env -f ./docker-compose.release.yml "$@"
}
jev_compose ps
```

If the existing installation uses `-p`, include its exact existing project name
in the function. A different project name can create a different database volume.

Before edits, create a private timestamped backup of the Compose file and env
file, record the running app image ID/digest and OCI revision label, and obtain a
verified database backup using the installation's existing procedure. Never
print the resolved Compose environment or credentials into the agent transcript.
Use `docker compose ... config --quiet` for validation. Record backup paths, not
secret contents. Do not run `down --volumes`, remove volumes, or change passwords.

## 2. Edit docker-compose.env

The owner supplies the real private TypeSafe API key directly to this file or
through the existing secret-management process. Use the following values; retain
all unrelated existing entries. Remove duplicate keys so there is one value for
each setting. Single quotes protect literal `$` characters in Compose env files.

```dotenv
PRODUCT_UNDERSTANDING_PROVIDER=typesafe
TYPESAFE_API_KEY='REPLACE_WITH_REAL_PRIVATE_TYPESAFE_KEY'
JEV_MODEL=jev-1.13.0

PRODUCT_RESOLUTION_PROVIDER=openai
STOCK_PREDICTION_PROVIDER=openai
SHELF_LIFE_POLICY_PROVIDER=openai
STOCK_WORKFLOW_ADVICE_ENABLED=false

LLM_PROVIDER=openai
# Retain the existing real OPENAI_API_KEY and existing LLM_MODEL.

# Optional collector; false is sufficient to begin this trial.
PRODUCT_UNDERSTANDING_CAPTURE_ENABLED=false
```

Keep API_AUTH_TOKEN, POSTGRES_PASSWORD, database values, APP_PORT, MCP_ENABLED,
and the existing scheduling settings. For the observed endpoint, the host port
was 43000; confirm the actual current mapping and retain it. Do not set
LLM_PROVIDER=typesafe, PRODUCT_UNDERSTANDING_PROVIDER=jev, or JEV_MODEL=latest.
No separate JEV endpoint variable is needed: the adapter uses
`https://api.typesafe.ai/v1/systemone`. The host needs outbound HTTPS to that API.
The application requires OPENAI_API_KEY even when understanding uses TypeSafe.
Omit unused optional variables rather than leaving them blank.

Set the file permissions to restrict credentials:

```sh
chmod 600 docker-compose.env
```

Choose the intended image with IMAGE_TAG=latest or IMAGE_TAG=sha-<published SHA>.
An existing IMAGE_REF overrides IMAGE_TAG; remove an obsolete IMAGE_REF to choose
another tag, or replace it with the exact intended digest. Shell environment
variables can override env-file values; clear conflicting overrides in the
agent's shell or verify their intended values privately before deployment.

## 3. Forward the settings into the app container

An `--env-file` supplies Compose interpolation values; it does not automatically
pass every variable to the container. The updated repository release Compose
file forwards these settings. Update your server copy to match it. If using a
custom Compose file, add this block under **app.environment**, preserving
its existing keys and indentation:

```yaml
      PRODUCT_UNDERSTANDING_PROVIDER: ${PRODUCT_UNDERSTANDING_PROVIDER:-openai}
      TYPESAFE_API_KEY:
      JEV_MODEL:
      PRODUCT_RESOLUTION_PROVIDER: ${PRODUCT_RESOLUTION_PROVIDER:-openai}
      STOCK_PREDICTION_PROVIDER: ${STOCK_PREDICTION_PROVIDER:-openai}
      SHELF_LIFE_POLICY_PROVIDER: ${SHELF_LIFE_POLICY_PROVIDER:-openai}
      STOCK_WORKFLOW_ADVICE_ENABLED: ${STOCK_WORKFLOW_ADVICE_ENABLED:-false}
      PRODUCT_UNDERSTANDING_CAPTURE_ENABLED: ${PRODUCT_UNDERSTANDING_CAPTURE_ENABLED:-false}
```

Bare TYPESAFE_API_KEY and JEV_MODEL entries forward values from the Compose
environment when present and omit them when absent, preserving OpenAI-only
startup. The app requires both when a task selector is typesafe. Leave the key
privately configured during selector rollback. Do not forward these keys to postgres.
The migrate service only needs its existing database environment.

For the published release stack, both app and migrate use:

```yaml
    image: ${IMAGE_REF:-ghcr.io/yairabf/home-stock-tracker:${IMAGE_TAG:-latest}}
```

Use registry images without `build:` for this procedure. Preserve existing mounts,
network configuration, database connection and app ports. If your Compose file
already passes these settings using `env_file:`, verify their effective values
instead of adding conflicting overrides.

Validate without displaying secrets:

```sh
jev_compose config --quiet
```

## 4. Pull and check the repaired image before replacing the app

```sh
jev_compose pull app migrate
jev_candidate_image=$(jev_compose config --images | awk '/^ghcr.io\/yairabf\/home-stock-tracker[:@]/ { print; exit }')
test -n "$jev_candidate_image"
jev_candidate_digest=$(docker image inspect "$jev_candidate_image" --format '{{range .RepoDigests}}{{println .}}{{end}}' | awk '/^ghcr.io\/yairabf\/home-stock-tracker@sha256:/ { print; exit }')
test -n "$jev_candidate_digest"
docker image inspect "$jev_candidate_digest" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
```

Compare that revision with the approved published source SHA. These commands
only pull/inspect images; the existing app is still running. Stop on any mismatch.
The image should contain the repaired adapter, checked without API calls:

```sh
docker run --rm --entrypoint node "$jev_candidate_digest" -e '
const fs = require("node:fs");
const roots = ["./dist/product", "./dist/src/product"];
const root = roots.find(p => fs.existsSync(p + "/jev-product-understanding.service.js"));
if (!root) throw new Error("Understanding adapter missing");
const version = require(root + "/jev-product-understanding.service.js").JEV_UNDERSTANDING_VERSION;
if (version !== "jev-product-understanding-v4") throw new Error("Untested adapter version: " + version);
for (const file of ["category-question.js", "product-type-question.js"])
  if (!fs.existsSync(root + "/" + file)) throw new Error("Missing repaired question builder");
console.log("Verified repaired understanding adapter:", version);
'
```

If this fails, do not restart the app with JEV enabled. Obtain the correct image.
If capture is requested, also verify the published image contains
`product-understanding-capture.service.js`; enabling the flag on an older image
does not implement collection.

## 5. Migrate and recreate the app using the verified digest

Persist `IMAGE_REF=<the exact value of jev_candidate_digest>` in docker-compose.env
so subsequent operations keep using it. Do not paste a literal placeholder. In
the same shell session export that digest for the commands below:

```sh
export IMAGE_REF="$jev_candidate_digest"
jev_compose config --quiet
jev_compose up --detach --wait postgres
jev_compose run --rm --no-deps migrate
jev_compose up --detach --wait --wait-timeout 120 --no-deps --force-recreate app
jev_compose ps
```

Run sequentially and stop immediately on failure. If migration fails, leave the
old app running and investigate. If app readiness fails after replacement, use
the rollback section. Skip the postgres command for an existing external database.
Do not deploy multiple scheduler-enabled replicas.

The repository update helper currently reads `.env`, not docker-compose.env.
Do not run it unchanged expecting this env file to be loaded; use the explicit
commands above. `docker compose restart app` alone will not apply changed env
values; the app container must be recreated.

## 6. Verify configuration and readiness without paid inference

Check only nonsecret settings and whether required keys are present:

```sh
jev_compose exec -T app node -e '
const expected = {
 PRODUCT_UNDERSTANDING_PROVIDER: "typesafe", JEV_MODEL: "jev-1.13.0",
 PRODUCT_RESOLUTION_PROVIDER: "openai", STOCK_PREDICTION_PROVIDER: "openai",
 SHELF_LIFE_POLICY_PROVIDER: "openai", STOCK_WORKFLOW_ADVICE_ENABLED: "false",
 LLM_PROVIDER: "openai"
};
for (const [key, value] of Object.entries(expected)) {
 if (process.env[key] !== value) throw new Error("Unexpected setting: " + key);
 console.log(key + "=" + value);
}
for (const key of ["TYPESAFE_API_KEY", "OPENAI_API_KEY", "API_AUTH_TOKEN", "DATABASE_URL"])
 if (!process.env[key]?.trim()) throw new Error("Missing required setting: " + key);
console.log("Required secrets present; values omitted");
'
jev_compose exec -T app node -e '
(async () => {
 for (const path of ["/health", "/ready"]) {
  const response = await fetch("http://127.0.0.1:3000" + path);
  console.log(path, response.status);
  if (response.status !== 200) process.exitCode = 1;
 }
})().catch(() => { console.error("Readiness request failed"); process.exitCode = 1; });
'
```

Both endpoints should return 200. Also verify the existing agent can perform an
ordinary authenticated grocery-list read through its current connection. Reads
and health checks do not exercise JEV or prove the TypeSafe key is valid. Do not
bulk-enrich products or run an evaluation CLI as a deployment smoke test.

For inference verification, observe the next genuine household operation that
needs missing metadata. A request for an already known complete product may
produce no inference. Inspect its private LlmInferenceLog records for
product-understanding-v1 payloads whose attempt provider is typesafe,
taskVersion is jev-product-understanding-v4 and resolvedModel is jev-1.13.0.
Check accepted/rejected/unavailable outcomes and writeOutcome rather than assuming
every inference was applied. Retain failed/rejected cases. Do not expose product
names or raw payloads in the public report. No separate synthetic or bulk paid
smoke requests are authorized by this runbook.

## 7. Optional collection and ordinary-use review

Capture is optional and can remain false. To enable it on a capture-capable image,
set PRODUCT_UNDERSTANDING_CAPTURE_ENABLED=true and recreate only app with the
same pinned digest. It saves exact pre-inference names, supplied metadata and
category/unit choices privately, even if the provider later fails. It does not
label data or prove accuracy, and complete supplied metadata bypasses capture.
See [backend capture and private export](jev-real-request-collection/backend-capture.md).

Review the first 10-20 genuine classifications where product identity is known,
including Hebrew requests. Record wrong accepted values, uncertainty, provider
failures and the effect on saved metadata. This is a practical trial review, not
a substitute for the formal launch corpus. Do not manufacture enough cases to
meet a quota. Any consequential accepted error warrants investigation and an
operator decision about reverting the trial.

## 8. Roll back only product classification

Change one line in docker-compose.env:

```dotenv
PRODUCT_UNDERSTANDING_PROVIDER=openai
```

Keep the current pinned image, database, other selectors, OpenAI key and TypeSafe
key. Recreate app to apply the selector change:

```sh
jev_compose up --detach --wait --wait-timeout 120 --no-deps --force-recreate app
```

Verify readiness again and check the nonsecret understanding selector is openai.
This returns future product understanding to the legacy OpenAI behavior; it does
not undo saved metadata, aliases, policies, events or previous model outputs.
Review any wrong saved fields separately through the supported product workflow.
No reverse migration is needed for selector rollback. If the new image itself is
broken, use the previously recorded digest only after checking schema compatibility;
an older image does not reverse migrations or restore the database automatically.

## Agent completion report

Return: actual published source SHA and running digest; app readiness statuses;
nonsecret selectors/model pin; capture enabled/disabled; migration success;
existing project/volume preserved; private backup locations; rollback selector;
and any outstanding failure. Never report the API keys, token, connection URL,
full Compose config, raw household requests or database dump. Distinguish
“configured and healthy” from “a genuine JEV classification was observed.”
