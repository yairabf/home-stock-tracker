# Feature: Deployment readiness

**From build-plan:** feature 18
**Status:** complete

## Completion record

- **Completed:** 2026-08-28
- **Delivered:** Added centralized, typed startup configuration validation;
  packaged the NestJS service as a Node 22 multi-stage Docker image with the
  generated Prisma client, migration CLI/assets, OpenSSL runtime, pruned
  development dependencies, and a non-root process; expanded Compose with a
  healthy PostgreSQL service, separate one-shot migration service, production app
  service, runtime secret injection, dependency gates, restart policy, and
  readiness probe; and documented the complete portable deployment procedure.
- **Changed areas:** Added `src/config/` and wired it through `src/main.ts`;
  completed `.env.example`; added `Dockerfile` and `.dockerignore`; updated
  `package.json`, `package-lock.json`, and `tsconfig.build.json` for the production
  entry point and migration runtime; expanded `docker-compose.yml`; added
  `docs/deployment.md` and linked it from `README.md`; and refreshed
  `graphify-out/` after the code changes.
- **Verification:** `npm run test -- --runInBand` passed 30 suites and 325 tests;
  `npm run build` passed; scoped `npx eslint
  src/config/application-config.ts src/config/application-config.spec.ts
  src/main.ts` passed; `git diff --check` passed; and `graphify update .`
  completed. Docker image inspection proved UID `1000`, `node dist/main.js`, the
  compiled entry point, Prisma CLI and seven migration assets, no `.env`, and no
  source or test directories. Isolated project `hst-f18-acceptance` applied all
  migrations to a fresh database, returned `200` from `/health` and database-up
  `/ready`, rejected unauthenticated business access with `401`, created and read
  an authenticated persisted product across an app-only restart, initialized MCP
  successfully when enabled, and exited `1` before Nest startup for a missing
  `API_AUTH_TOKEN` without printing the synthetic secret. Its containers,
  network, and disposable volume were removed afterward.
- **Deviations:** None. Remote provider deployment remains deferred as specified
  because the target host has not been chosen. The production dependency install
  reports three high-severity npm audit findings for separate review; no
  potentially breaking automatic upgrade was applied.

## Goal

Package the NestJS service as a production-ready Docker image, make database
migrations and runtime configuration explicit, and prove the resulting image can
start against a fresh PostgreSQL database and serve its protected REST and MCP
surfaces. The artifact must remain portable because the final remote host has not
been selected.

## In scope

- Add a reproducible multi-stage Docker build for the NestJS service.
- Run the service as a non-root user with only production runtime artifacts and
  dependencies in the final image.
- Add an app service to Docker Compose for a production-like local deployment
  against the existing PostgreSQL service.
- Define a separate, explicit Prisma migration command that operators or a
  platform release phase run before starting a new app version.
- Complete `.env.example` with required, optional, defaulted, and conditional
  production configuration, without committing secrets.
- Configure container liveness/readiness checks using the existing public
  `/health` and `/ready` contracts.
- Verify image build, fresh-database migration, authenticated REST and MCP access,
  database persistence across an app restart, and clean failure when required
  configuration is missing.
- Document the portable deploy sequence, health checks, migration ownership,
  secret handling, and rollback limitation.

## Out of scope

- Choosing a VPS or managed container provider, adding provider-specific files,
  creating remote resources, setting remote environment variables, deploying,
  publishing an image, or changing DNS/network/firewall settings. Those require
  a separately approved `/release <target>` run after a host is chosen.
- PostgreSQL provisioning, backup automation, restore drills, high availability,
  TLS termination, certificate management, or private-network configuration.
- Running migrations automatically in every app replica or at application
  startup.
- CI configuration, registry publishing, image signing, vulnerability scanning,
  metrics, tracing, or alerting.
- Schema or application API changes, seed data, Redis/BullMQ, and background
  workers.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lock the production configuration contract** - add a small
  startup configuration boundary for `NODE_ENV`, `PORT`, `DATABASE_URL`,
  `API_AUTH_TOKEN`, `LOG_LEVEL`, `MCP_ENABLED`, `LLM_PROVIDER`, `LLM_MODEL`, and
  `OPENAI_API_KEY`; preserve existing defaults, validate required and conditional
  values before listening, and update `.env.example` with safe placeholders and
  descriptions. Add focused Jest coverage for valid defaults, malformed values,
  and missing conditional secrets. *Done when: one documented contract governs
  application startup, invalid or incomplete production configuration exits with
  a clear variable-specific error before the HTTP server listens, development
  defaults remain usable, and `.env.example` contains every variable the current
  source reads without containing a real credential.*
- [x] **Step 2 - Create the production image** - add a multi-stage `Dockerfile`
  and `.dockerignore` that install from `package-lock.json`, generate the Prisma
  client, compile `dist/`, prune development dependencies, copy the generated
  Prisma client and migration assets needed at runtime, and execute the app as a
  non-root user. Add explicit package scripts for production start and migration
  deployment where needed. *Done when: `docker build` succeeds from a clean
  context, the final image starts with `node dist/main`, contains the Prisma
  migration files and CLI path required by the migration command, excludes local
  secrets and source-only clutter, and its process runs as a non-root user.*
- [x] **Step 3 - Wire a production-like Compose deployment** - extend the
  existing Compose file with an app service that uses the image, container-local
  PostgreSQL addressing, dependency health conditions, restart policy, explicit
  environment forwarding, and the existing `/health` and `/ready` probes. Keep
  migration execution a distinct one-shot service or documented Compose command,
  not part of every app replica's startup. *Done when: the migration command can
  prepare an empty Compose database exactly once, the app waits for a healthy
  database, liveness and readiness become healthy, and neither the image nor
  Compose file embeds a real database password, API token, or OpenAI key.*
- [x] **Step 4 - Document the deployment runbook** - add a concise operator
  guide covering prerequisites, required and conditional variables, secret
  injection, image build, migration-before-start ordering, health/readiness
  checks, authenticated REST and optional MCP smoke tests, restart behavior, log
  inspection, and rollback. State that schema migrations are forward-only unless
  a tested compensating migration exists and that database backups are an
  operator responsibility. *Done when: an operator can follow copyable commands
  from a clean checkout to build, migrate, start, probe, smoke-test, restart, and
  stop the stack without consulting source code or exposing secrets in the
  document.*
- [x] **Step 5 - Run the production-container acceptance gate** - use an isolated
  Compose project and fresh database volume to execute the documented sequence,
  exercise one authenticated persisted business action and the MCP endpoint when
  enabled, restart only the app container, and rerun probes plus the persisted
  read. Also test one missing required variable, then run unit tests, production
  build, scoped lint, and `git diff --check`. *Done when: the fresh migration and
  app startup succeed; `/health` and `/ready` return their documented statuses;
  unauthenticated business access returns `401`; authenticated REST and enabled
  MCP calls succeed; persisted data survives app restart; invalid configuration
  fails before listen without printing secrets; `npm run test` and
  `npm run build` pass; scoped lint and `git diff --check` pass; and the exact
  commands and observed results are recorded in this spec.*

## Files / areas

- New root `Dockerfile` and `.dockerignore`.
- Existing `docker-compose.yml` for the app, database, migration, dependency,
  health-check, and environment wiring.
- `package.json` and `package-lock.json` only for explicit production and
  migration scripts or dependency classification required by the image.
- A focused configuration module under `src/config/`, plus `src/main.ts` and
  `src/app.module.ts` only as needed to validate before listening.
- `.env.example` for the complete safe configuration inventory.
- A deployment runbook under `docs/` or the root `README.md`, following the
  repository's established documentation location.
- Existing Jest areas for configuration tests. No Prisma schema migration is
  expected, but existing `prisma/migrations/` must be packaged and exercised.

## Data / contracts

- **Load-bearing image contract:** the image is built from the committed lockfile,
  listens on `PORT` (default `3000`), starts the compiled NestJS entry point, and
  runs as a non-root user. It contains no `.env` file or baked secret.
- **Load-bearing release contract:** migration is a separate one-shot operation
  using `prisma migrate deploy`; it must complete successfully before the new app
  version starts. App replicas never race to migrate on boot.
- **Required runtime variables:** `DATABASE_URL` and `API_AUTH_TOKEN` are
  non-blank. The token retains feature 16's no-surrounding-whitespace rule.
- **Optional runtime variables:** `NODE_ENV` defaults to the current Node
  behavior outside the production Compose profile; `PORT` defaults to `3000`;
  `LOG_LEVEL` defaults to `log`; `MCP_ENABLED` defaults to disabled unless exactly
  `true`; `LLM_PROVIDER` defaults to the existing `openai` provider;
  `LLM_MODEL` defaults to the application's current OpenAI model.
- **Conditional runtime variable:** `OPENAI_API_KEY` is required only when the
  selected `LLM_PROVIDER` is `openai`. Unsupported providers fail startup through
  the existing provider registry.
- **Compose contract:** the app uses the PostgreSQL service hostname rather than
  `localhost`; host port mappings are configurable; health checks call public,
  unprefixed `/health` and `/ready`; secrets arrive through the runtime
  environment, not Compose literals.
- **Existing external contracts stay fixed:** business REST routes remain under
  `/api/v1`, `/mcp` remains unprefixed and feature-gated, `/health` remains a
  liveness probe, `/ready` remains a PostgreSQL readiness probe, and bearer-token
  authentication still protects every business surface.
- No persisted schema or response-shape changes.

## Testing

- Jest tests cover configuration parsing and validation because a test command is
  configured and this step introduces startup logic.
- Docker acceptance uses a uniquely named Compose project and disposable fresh
  database volume so it cannot alter the developer's normal stack. Cleanup occurs
  after evidence is captured and removes only resources created by that project.
- Acceptance observes exact probe status codes, authentication rejection,
  authenticated REST/MCP success, migration success, persisted data after app
  restart, non-root execution, and safe startup failure.
- Run `npm run test`, `npm run build`, scoped ESLint without auto-fixing unrelated
  files, and `git diff --check`. `Verify` is not configured.
- Remote provider verification is deferred until a host is chosen and the user
  separately authorizes `/release <target>` and deployment.
- **Final acceptance evidence (2026-08-28):** built image
  `home-stock-tracker:feature-18-acceptance`; started fresh isolated Compose
  project `hst-f18-acceptance` on app port `33019` and PostgreSQL host port
  `35433`; applied all seven committed migrations with `prisma migrate deploy`;
  observed `200` from `/health` and database-up `/ready`, `401` from an
  unauthenticated products request, `201` from an authenticated product create,
  authenticated product persistence before and after an app-only restart, and a
  successful MCP initialization with MCP enabled. An ephemeral image run missing
  `API_AUTH_TOKEN` exited `1` before Nest startup with a variable-specific error
  and did not print the synthetic OpenAI secret. The isolated containers,
  network, and fresh database volume were removed after verification.
- **Acceptance commands:** with synthetic credentials supplied through the
  process environment, ran `docker compose --project-name hst-f18-acceptance
  build app migrate`, `docker compose --project-name hst-f18-acceptance up
  --detach --wait postgres`, `docker compose --project-name
  hst-f18-acceptance run --rm migrate`, `docker compose --project-name
  hst-f18-acceptance up --detach --wait --no-deps app`, `docker compose
  --project-name hst-f18-acceptance restart app`, and the same app wait command
  after restart. Used Node `fetch` assertions against the REST and MCP contracts,
  ran an ephemeral `docker run --rm` missing `API_AUTH_TOKEN`, then removed the
  test project with `docker compose --project-name hst-f18-acceptance down
  --volumes --remove-orphans`. Final local gates were `npm run test --
  --runInBand`, `npm run build`, scoped `npx eslint`, `git diff --check`, and
  `graphify update .`.

## Notes for the AI

- Preserve the existing npm, NestJS 11, Prisma 7 PostgreSQL adapter, CommonJS
  build, and generated-client layout. Confirm Prisma CLI/runtime requirements in
  the built image rather than assuming pruning leaves the migration command
  usable.
- Keep configuration validation centralized and typed. Do not add a configuration
  dependency unless the existing stack cannot express the contract cleanly and
  the user approves it.
- Validate before `app.listen`; never print variable values, URLs, tokens, or API
  keys in startup errors or logs.
- Do not use `prisma migrate dev`, `db push`, seed commands, or destructive reset
  operations in production or acceptance testing. Use only committed migrations
  with `prisma migrate deploy`.
- Do not couple migration execution to normal app startup. Container platforms
  may scale multiple replicas, so migrations need a separately owned release
  step.
- Use an LTS Node base image compatible with the lockfile and Prisma 7. Pin at
  least the major version; do not use `latest`.
- Make Docker health commands self-contained with tools already present in the
  final image. Do not install a large utility solely to probe HTTP.
- Keep remote changes out of implementation. `/release` owns provider-specific
  readiness and must still stop before deployment without separate approval.
