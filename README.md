# Home Stock Tracker

Home Stock Tracker is a private NestJS service that manages a household grocery
list, records purchases and stock observations, and estimates what is probably
available, low, or out. It is designed for conversational use through agents
such as [Hermes Agent](https://hermes-agent.nousresearch.com/) and
[OpenClaw](https://docs.openclaw.ai/), while also exposing a REST API.

The service favors useful estimates over false precision. It stores durable
inventory events, learns from household history, and can combine deterministic
signals with optional OpenAI reasoning to produce confidence-scored estimates
and low-stock recommendations.

## Documentation

| Guide | Contents |
| --- | --- |
| [API and MCP reference](docs/api-reference.md) | Authentication, REST routes, request values, MCP endpoint, all ten tools, and safe tool workflows. |
| [Agent integrations](docs/agent-integrations.md) | Complete Hermes, OpenClaw, and generic MCP-client setup with official references. |
| [Operations guide](docs/operations.md) | Environment variables, predictions, health checks, logs, security, database operations, troubleshooting, and limitations. |
| [Deployment guide](docs/deployment.md) | Production Docker and Compose configuration, migrations, smoke tests, rollback, and recovery. |
| [Hermes skill guide](integrations/hermes/home-stock-tracker/README.md) | Skill installation, WhatsApp delivery, and proactive stock-check cron jobs. |

Official agent references:

- [Hermes Agent documentation](https://hermes-agent.nousresearch.com/docs)
- [Hermes MCP documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [OpenClaw documentation](https://docs.openclaw.ai/)
- [OpenClaw MCP documentation](https://docs.openclaw.ai/cli/mcp)

## What it does

- Maintains canonical products and aliases.
- Adds, lists, removes, and completes grocery-list items.
- Records purchases, restocks, and direct stock signals.
- Preserves an append-only inventory event history.
- Learns product-specific purchase and need intervals.
- Estimates `likely_available`, `probably_low`, `probably_out`, or `uncertain`.
- Records accepted, rejected, and corrected prediction feedback.
- Returns recommendations above the household confidence threshold.
- Exposes the same business rules through REST and MCP.

It does not parse messages or send notifications. Hermes, OpenClaw, or another
client owns conversation and delivery; Home Stock Tracker owns household state,
validation, persistence, and prediction.

## Architecture

```text
Household member
      |
      v
Hermes / OpenClaw / another MCP agent
      |
      v
Home Stock Tracker (NestJS REST + MCP)
      |
      v
PostgreSQL

Home Stock Tracker -> OpenAI Responses API
```

This is a private, single-household service. One bearer token protects all
business REST routes and the MCP endpoint. `/health` and `/ready` remain public
for infrastructure monitoring.

## Quickstart

Prerequisites: Node.js 20 or newer, npm, Docker with Docker Compose, and `curl`.

```bash
npm ci
cp .env.example .env
npx prisma generate
openssl rand -hex 32
```

Replace every `replace-with-...` value in `.env`, including
`POSTGRES_PASSWORD`, `API_AUTH_TOKEN`, and `OPENAI_API_KEY`. Then start
PostgreSQL, apply migrations, and run the service:

```bash
docker compose up -d postgres
npx prisma migrate deploy
npm run start:dev
```

Verify the process and database:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Verify authenticated access:

```bash
export HOME_STOCK_URL="http://localhost:3000"
export HOME_STOCK_TOKEN="replace-with-the-token-from-your-env-file"

curl -sS \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  "${HOME_STOCK_URL}/api/v1/products"
```

A new database has no products. Create products through the
[REST API](docs/api-reference.md#first-use-example) before asking an agent to
manage them.

To connect an agent, set `MCP_ENABLED=true`, restart the service, and follow the
[agent integration guide](docs/agent-integrations.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Start NestJS in watch mode. |
| `npm run build` | Compile into `dist/`. |
| `npm run start:prod` | Run a previously built application. |
| `npm run lint` | Run ESLint with configured fixes. |
| `npm run format` | Format TypeScript sources and tests. |
| `npm run test` | Run Jest unit tests. |
| `npm run test:e2e` | Run end-to-end tests against PostgreSQL. |

## Current status

The PostgreSQL schema, REST API, MCP tools, service authentication, health
checks, structured logging, production image, and production-like Compose stack
are implemented. Provider-specific hosting, TLS, backups, and secret management
remain operator responsibilities; follow the [deployment guide](docs/deployment.md).

This project uses the AI Blueprint development workflow. See [AGENTS.md](AGENTS.md)
for repository conventions and [`blueprint/`](blueprint/) for the roadmap and
implementation history.
