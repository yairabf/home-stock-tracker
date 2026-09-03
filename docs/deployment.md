# Deployment

This runbook deploys Home Stock Tracker as a private Docker service with
PostgreSQL. The Compose stack is production-like and portable; provider-specific
networking, TLS, backups, and secret stores remain operator responsibilities.

## Prerequisites

- Docker Engine with Docker Compose v2
- A clean checkout of the intended release
- Private network access from Hermes to the service
- A backup policy for the PostgreSQL volume or external database

Run every command from the repository root.

## Configure the environment

Create the ignored runtime file and edit it before building:

```bash
cp .env.example .env
```

Replace every `replace-with-...` placeholder. Do not commit `.env`, paste its
contents into logs, or bake it into an image.

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Required | PostgreSQL credential used by the database, migration, and app containers. |
| `POSTGRES_USER` | Optional, default `home_stock` | PostgreSQL role. |
| `POSTGRES_DB` | Optional, default `home_stock_tracker` | PostgreSQL database. |
| `POSTGRES_PORT` | Optional, default `5432` | Host-only PostgreSQL port mapping. Containers always use `postgres:5432`. |
| `API_AUTH_TOKEN` | Required | Private bearer token shared with Hermes. Use a long random value without surrounding whitespace. |
| `OPENAI_API_KEY` | Required for `LLM_PROVIDER=openai` | OpenAI credential. |
| `LLM_PROVIDER` | Optional, default `openai` | Structured inference provider. Only `openai` is currently supported. |
| `LLM_MODEL` | Optional, default `gpt-5.6-sol` | OpenAI model override. |
| `MCP_ENABLED` | Optional, default `false` | Set exactly `true` to expose `/mcp`. |
| `LOG_LEVEL` | Optional, default `log` | One of `fatal`, `error`, `warn`, `log`, `debug`, or `verbose`. |
| `STOCK_WORKFLOW_ENABLED` | Optional, default `true` | Enables the internal daily stock workflow. Use one enabled replica only. |
| `STOCK_WORKFLOW_CRON` | Optional, default `0 2 * * *` | Cron expression for stock evaluation. |
| `STOCK_WORKFLOW_TIMEZONE` | Optional, default `Asia/Jerusalem` | IANA timezone for the stock cron. |
| `APP_PORT` | Optional, default `3000` | Host port for the service. |
| `IMAGE_TAG` | Optional, default `local` | Local image tag used by Compose. Use an immutable release identifier in deployment. |

`NODE_ENV=production`, container `PORT=3000`, and the container-local
`DATABASE_URL` are owned by Compose. Do not change them to host-oriented values.
For a managed external PostgreSQL deployment, provide an equivalent
`DATABASE_URL` through the platform's secret configuration rather than editing
the image.

The stock scheduler has no distributed lock. When running multiple app
replicas, designate exactly one with `STOCK_WORKFLOW_ENABLED=true` and disable it
on the others.

## Build the image

Choose an immutable release tag in `.env`, then build from the committed
lockfile:

```bash
docker compose build app migrate
```

The image contains the compiled app, production dependencies, Prisma CLI, and
committed migrations. It runs as the non-root `node` user and contains no local
`.env` file.

## Migrate before starting the app

Start PostgreSQL and run the one-shot migration service:

```bash
docker compose up --detach --wait postgres
docker compose run --rm migrate
```

The migration command is `prisma migrate deploy`. A successful run exits with
code `0` and reports that migrations were applied or already present. Do not use
`prisma migrate dev`, `prisma db push`, or a database reset in deployment.

Run migrations once per release before starting new app replicas. Do not add
migration execution to normal app startup because concurrent replicas could race
to modify the schema.

## Start and inspect the service

After migration succeeds, start the app without rerunning its dependencies:

```bash
docker compose up --detach --wait --no-deps app
docker compose ps
```

Inspect structured logs without printing the environment:

```bash
docker compose logs --tail 100 app
docker compose logs --tail 100 migrate
```

Do not use `docker compose config`, `docker inspect`, or `env` output in shared
logs unless secret values are redacted.

## Probe and smoke-test

Set the host port if it differs from the default:

```bash
APP_URL=http://127.0.0.1:3000
curl --fail --silent "$APP_URL/health"
curl --fail --silent "$APP_URL/ready"
```

Expected responses are:

```json
{"status":"ok"}
{"status":"ok","checks":{"database":"up"}}
```

The probes are intentionally public. Business routes must reject missing bearer
authentication:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  "$APP_URL/api/v1/products"
```

The expected status is `401`. Read the service token without echoing it, then
verify authenticated REST access:

```bash
read -r -s -p 'API auth token: ' SERVICE_TOKEN
printf '\n'
curl --fail --silent \
  --header "Authorization: Bearer $SERVICE_TOKEN" \
  "$APP_URL/api/v1/products"
unset SERVICE_TOKEN
```

An empty installation returns `[]`.

If `MCP_ENABLED=true`, read the token again and initialize the MCP endpoint:

```bash
read -r -s -p 'API auth token: ' SERVICE_TOKEN
printf '\n'
curl --fail --silent \
  --request POST \
  --header "Authorization: Bearer $SERVICE_TOKEN" \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"deployment-smoke","version":"1.0.0"}}}' \
  "$APP_URL/mcp"
unset SERVICE_TOKEN
```

Expect a successful JSON-RPC initialization response. When MCP is disabled,
authenticated access to `/mcp` returns `404`.

## Restart and stop

Restart only the application, leaving PostgreSQL and its volume intact:

```bash
docker compose restart app
docker compose up --detach --wait --no-deps app
curl --fail --silent "$APP_URL/ready"
```

Stop containers while preserving PostgreSQL data:

```bash
docker compose down
```

Do not add `--volumes` in production. That option removes the Compose-managed
database volume and is reserved for explicitly disposable environments.

## Rollback and recovery

Application rollback means selecting the previous immutable `IMAGE_TAG` and
starting that image again. Before doing so, confirm it is compatible with the
current database schema.

Prisma production migrations are forward-only. There is no automatic down
migration. If a schema change is incompatible, use a separately reviewed and
tested compensating migration or restore a verified database backup according to
the operator's recovery procedure. Never assume rolling back only the app image
also rolls back persisted data.

Database backup scheduling, retention, encryption, and restore drills are
required deployment operations but are not automated by this repository.
