# Operations Guide

This guide covers runtime configuration, prediction behavior, health, logging,
security, database maintenance, troubleshooting, and current limitations.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | None | PostgreSQL connection used by Prisma. |
| `API_AUTH_TOKEN` | Yes | None | Shared bearer credential for REST and MCP. |
| `PORT` | No | `3000` | HTTP listening port. |
| `MCP_ENABLED` | No | Disabled | `/mcp` exists only when exactly `true`. |
| `LOG_LEVEL` | No | NestJS default | `fatal`, `error`, `warn`, `log`, `debug`, or `verbose`. |
| `LLM_PROVIDER` | No | `openai` | Only `openai` is currently registered. |
| `OPENAI_API_KEY` | Yes | None | Required credential for the supported OpenAI provider. |
| `LLM_MODEL` | No | `gpt-5.6-sol` | OpenAI structured-generation model. |
| `POSTGRES_USER` | Compose only | `home_stock` | Local database user. |
| `POSTGRES_PASSWORD` | Compose only | `home_stock` | Local password. Change outside development. |
| `POSTGRES_DB` | Compose only | `home_stock_tracker` | Local database name. |
| `POSTGRES_PORT` | Compose only | `5432` | Host port mapped to PostgreSQL. |

The application refuses to start when `OPENAI_API_KEY` is absent because
`openai` is the only supported provider. It also refuses to start when
`API_AUTH_TOKEN` is missing, blank, or surrounded by whitespace.

## Predictions and recommendations

Predictions include a state, confidence, reason, optional action, deterministic
signals, whether an LLM contributed, and a prediction ID when feedback can be
recorded.

Direct stock observations can be authoritative. Otherwise the engine considers
event recency, purchase patterns, learned intervals, product type,
perishability, and household context. OpenAI may contribute structured reasoning
but never writes directly to PostgreSQL.

Low-stock recommendations include only `probably_low` and `probably_out`
results meeting the household threshold. They preserve service order and do not
mutate the grocery list. `uncertain` and an empty recommendation list are valid
results, especially with sparse history.

## Health and readiness

- `GET /health` proves the process answers HTTP.
- `GET /ready` runs `SELECT 1` through Prisma.
- Healthy liveness with failed readiness usually means PostgreSQL or
  `DATABASE_URL` needs attention.

Health routes are public and never invoke the LLM or mutate data.

## Structured logs

Logs cover inventory actions, prediction execution and persistence, LLM
failures, and MCP failures. They intentionally exclude bearer tokens, prompts,
product names, household content, quantities, reasons, recommendations, and raw
provider errors.

Use `LOG_LEVEL` to select verbosity. `log` is appropriate for normal local use;
enable `debug` or `verbose` temporarily.

## Security

- One shared bearer token protects REST and MCP. There are no users, sessions,
  OAuth flows, or per-agent permissions.
- Generate a long random token and store it in each runtime's secret store.
- Never pass the token in URLs or commit it to source control.
- Rotate the service and every client together, then restart them.
- Prefer private networking and require HTTPS across untrusted networks.
- Restrict agent access to the smallest necessary set of tools and skills.

## Database lifecycle

Apply committed migrations after changing versions:

```bash
npx prisma migrate deploy
```

Do not replace committed migrations with `prisma db push`. Back up PostgreSQL
before upgrades or destructive maintenance.

Stop local PostgreSQL without deleting data:

```bash
docker compose stop postgres
```

The `postgres_data` volume persists data. Removing it erases the local database
and is intentionally not part of normal shutdown.

## Troubleshooting

### Startup fails

- Confirm `.env` exists.
- Ensure `API_AUTH_TOKEN` is non-empty without surrounding whitespace.
- Confirm `DATABASE_URL` is valid.
- Remember that `LLM_PROVIDER` currently accepts only `openai`.

### `/ready` returns `503`

- Run `docker compose ps` and wait for PostgreSQL health.
- Match `DATABASE_URL` to the Compose user, password, database, and port.
- Apply migrations with `npx prisma migrate deploy`.

### A product is not found

The service does not perform fuzzy creation. Create the canonical product or
add an alias, then retry. Agents must never invent a product UUID.

### Predictions remain uncertain

Record real purchases and direct stock signals over time, recalculate product
statistics when appropriate, and review the household confidence threshold. Do
not manufacture events solely to force recommendations.

### OpenAI is unavailable

Check `OPENAI_API_KEY`, `LLM_MODEL`, and network access. Provider failures are
sanitized and deterministic behavior remains available where possible.

Agent-specific failures are covered in
[Agent Integration Troubleshooting](agent-integrations.md#integration-troubleshooting).

## Current limitations

- One household and one shared credential
- No web or mobile UI and no exact real-time counts
- Production deployment still requires operator-owned hosting, TLS, backups,
  and secret management
- No built-in scheduler or messaging delivery
- OpenAI is the only implemented LLM adapter
- No receipt OCR, barcode scanning, expiration tracking, storage locations,
  supermarket integration, or automatic purchasing
- No Redis, background queue, or separate prediction worker
- No generated OpenAPI/Swagger site

See the [API reference](api-reference.md) for current interfaces and the
[deployment guide](deployment.md) for the Docker/Compose runbook. The
[Blueprint roadmap](../blueprint/build-plan.md) records planned work.
