# Feature: Service authentication

**From build-plan:** feature 16
**Status:** complete

## Completion record

- **Completed:** 2026-08-28
- **Delivered:** Added one fail-closed service-to-service bearer-token boundary
  for the versioned REST API and unprefixed MCP transport. The service validates
  `API_AUTH_TOKEN` during startup, rejects malformed, duplicate, missing, and
  incorrect credentials with a sanitized `401`, compares equal-length tokens in
  constant time, and leaves authenticated REST and MCP contracts unchanged.
- **Changed areas:** Added the injectable authentication module, configuration
  service, global guard, and focused Jest coverage under `src/auth/`; registered
  the guard once in `src/app.module.ts`; added REST and MCP transport contract
  coverage; isolated older domain e2e suites with an explicit authentication
  bypass; documented `API_AUTH_TOKEN` in `.env.example`; and refreshed
  `graphify-out/`.
- **Verification:** `npm run test -- --runInBand` passed 25 suites and 276 tests;
  `npm run build` passed; the focused REST authentication e2e suite passed 4
  tests; the focused MCP controller suite passed 6 tests; scoped ESLint over the
  new authentication files, `AppModule`, and new authentication test support
  passed; and `git diff --check` passed. Rejected REST requests did not invoke
  the route handler, rejected MCP requests did not create a server, authorized
  SDK clients initialized and called tools, and authenticated disabled-MCP
  requests preserved the existing `404`.
- **Deviations:** The full database-backed e2e gate could not run to completion
  because PostgreSQL refused connections on `localhost:5432`; 3 non-database
  suites passed and 5 existing database suites were environmentally blocked.
  A broad lint run also surfaced 63 existing errors and 7 warnings in legacy
  e2e code outside the authentication changes; these were left out of scope.

## Goal

Protect every REST and MCP request with the same private service-to-service
bearer token. Hermes remains the sole trusted client, and requests without the
configured credential cannot reach controllers or domain services.

## In scope

- Read the service credential from the required `API_AUTH_TOKEN` environment
  variable and reject application startup when it is missing or blank.
- Parse `Authorization: Bearer <service-token>` and compare the credential
  without a timing-sensitive string comparison.
- Apply authentication globally to the versioned REST surface and the
  unprefixed `/mcp` transport.
- Return the same sanitized `401 Unauthorized` response for missing, malformed,
  and incorrect credentials, without logging or returning either token.
- Document the environment variable and prove authorized and unauthorized REST
  and MCP behavior with automated tests.

## Out of scope

- User accounts, household/member identities, OAuth, sessions, roles, or
  per-route authorization.
- Multiple active credentials, token rotation, credential persistence, or an
  administrative token-management API.
- HTTPS, private-network configuration, IP restrictions, rate limits, request
  size limits, and deployment-secret provisioning (feature 18).
- Public health/readiness exceptions (feature 17). When those routes are added,
  their exposure policy must be decided explicitly rather than weakening this
  feature's global default.
- Changes to domain services, database schema, MCP tool contracts, or response
  payloads after authentication succeeds.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Define and test the authentication boundary** - add a focused
  authentication module/provider and guard that validates `API_AUTH_TOKEN` at
  startup, accepts exactly one non-empty Bearer credential, performs a
  constant-time comparison, and produces a generic unauthorized failure for
  every invalid header shape. Add focused Jest coverage for valid, missing,
  blank, malformed, and incorrect configuration/header cases, and add the
  variable to `.env.example` with a non-secret placeholder. *Done when: the
  focused test suite proves startup fails closed for absent configuration and
  the guard allows only the configured bearer token without exposing it.*
- [x] **Step 2 - Protect the REST surface globally** - register the guard once at
  the application-module boundary and add an HTTP contract test covering a
  representative versioned REST route with no header, malformed/wrong headers,
  and the valid header. Keep unrelated controller/service unit tests isolated;
  update existing full-application e2e harnesses to provide or explicitly
  override authentication so their domain assertions still test their intended
  concern. *Done when: unauthenticated REST requests return `401`, a valid
  credential preserves the existing route response, and the protected request
  cannot invoke the route handler before authentication succeeds.*
- [x] **Step 3 - Prove MCP uses the same boundary** - extend the existing MCP
  transport tests so initialization without or with an incorrect bearer token
  receives `401`, while an MCP client using the configured token can initialize,
  list tools, and call a tool. Preserve the existing disabled-MCP `404` behavior
  for an authenticated request. *Done when: `/mcp` shares the global REST
  credential contract, invalid requests never initialize an MCP server, and
  authorized MCP behavior and tool contracts are unchanged.*
- [x] **Step 4 - Run the authentication regression gate** - run formatting or
  lint checks relevant to changed files, the complete Jest unit suite, the
  database-backed e2e suite when PostgreSQL is available, and the production
  build. *Done when: `npm run test` and `npm run build` pass, `npm run test:e2e`
  passes against the configured test database (or its environmental blocker is
  recorded explicitly), and no test or response output contains the configured
  token.*

## Files / areas

- New focused files under `src/auth/` for configuration, guard behavior, module
  wiring, and unit tests.
- `src/app.module.ts` for one global guard registration.
- `src/mcp/mcp.controller.spec.ts` for authenticated MCP transport coverage.
- A focused HTTP authentication e2e spec under `test/`, plus minimal setup
  changes to existing full-application e2e suites.
- `.env.example` for the `API_AUTH_TOKEN` contract.
- No Prisma schema or migration changes.

## Data / contracts

- **Load-bearing request contract:** protected requests send exactly one
  `Authorization` header using `Bearer <token>`. The scheme is matched
  case-insensitively; the credential must be non-empty and must match the
  configured token exactly. Request credentials are never trimmed or
  transformed.
- **Load-bearing configuration contract:** `API_AUTH_TOKEN` is required and
  non-blank, and leading or trailing whitespace is invalid rather than silently
  normalized. Application bootstrap fails before listening when it is invalid.
- **Failure contract:** missing, duplicate, malformed, or incorrect credentials
  all return the standard sanitized NestJS `401 Unauthorized` shape. The guard
  does not reveal which check failed and does not log credential values.
- **Success contract:** authenticated requests retain all existing REST status
  codes/payloads and MCP JSON-RPC/tool behavior.
- No persisted data or database contract changes.

## Testing

- Jest unit tests cover configuration validation, Bearer parsing, exact token
  matching, malformed/duplicate header handling, and the constant-time compare
  path without asserting secret values in failures.
- HTTP contract coverage proves unauthorized requests are stopped before the
  handler and an authorized request preserves its response.
- MCP transport coverage proves both rejected initialization and a complete
  authorized initialize/list/call flow, including authenticated disabled-MCP
  behavior.
- Run `npm run test` for the configured unit-test gate, `npm run test:e2e` for
  REST/MCP integration behavior when PostgreSQL is available, and
  `npm run build` as the project fallback build gate. `Verify` is not configured.
- **Step 4 environment evidence (2026-08-28):** the complete unit suite and
  production build pass. The full e2e command runs 8 suites; 3 non-database
  suites pass, including the service-authentication contract, while 5 existing
  database-backed suites are blocked by PostgreSQL refusing connections on
  `localhost:5432` (`ECONNREFUSED`).

## Notes for the AI

- Use a NestJS guard registered globally through dependency injection. Do not
  add authentication checks to individual controllers or MCP tools.
- Keep configuration access behind an injectable provider. Domain services and
  controllers must not read `API_AUTH_TOKEN` directly.
- Use Node's `crypto.timingSafeEqual` only with equal-length buffers; differing
  lengths must fail safely without throwing. Do not add a dependency for this.
- Inspect the raw request header list so repeated `Authorization` fields cannot
  be hidden by Node/Express normalization. Treat arrays, repeated fields, and
  comma-joined credential values as malformed and fail closed.
- Authentication runs before the MCP controller's `MCP_ENABLED` check, so an
  unauthenticated caller receives `401`; only an authenticated caller can
  observe the disabled endpoint's existing `404`.
- Do not create a health-route bypass in anticipation of feature 17.
- Preserve the global `/api/v1` prefix and its existing `/mcp` exclusion.
- Keep tests deterministic by restoring mutated environment variables after
  each case. Never place a real credential in source, fixtures, snapshots, or
  logs.
