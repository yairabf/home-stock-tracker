# Agent Integrations

Home Stock Tracker is an authenticated remote MCP server. This guide covers
[Hermes Agent](#hermes-agent), [OpenClaw](#openclaw), and
[other MCP clients](#other-mcp-clients). Tool contracts are documented in the
[API and MCP reference](api-reference.md#mcp-server).

The generated bundle manifests are the install contract:

- [Hermes manifest](../integrations/hermes/home-stock-tracker/manifest.json)
- [OpenClaw manifest](../integrations/openclaw/home-stock-tracker/manifest.json)

Use their `requiredTools`, `mcp`, `verification`, and `rollback` fields instead
of copying tool counts or release versions into deployment notes.

The current bundles teach both agents to read materialized household inventory,
record atomic multi-product purchases, apply explicit stock updates, and present
committed grocery items separately from low-stock suggestions. A suggestion is
added only after explicit confirmation through the normal grocery workflow.

## Shared prerequisites

1. Start Home Stock Tracker and confirm `/health` and `/ready` succeed.
2. Set `MCP_ENABLED=true` in the service `.env` and restart it.
3. Give the client network access to `http://<service-host>:3000/mcp`.
4. Configure `Authorization: Bearer <API_AUTH_TOKEN>` in the client.
5. Keep the token outside this repository and use HTTPS or private networking
   when traffic leaves the machine.

Configure the single household before running the bundle probe. The probe fails
closed when household setup is missing and never creates defaults.

`localhost` works only when the agent and service share a network namespace. A
containerized agent normally needs a Compose service name, private DNS name, or
host gateway address.

## Hermes Agent

Hermes uses two pieces:

- The MCP connection exposes Home Stock Tracker's tools.
- The checked-in skill teaches safe tool selection and multi-step workflows.

Official references:

- [Hermes Agent documentation](https://hermes-agent.nousresearch.com/docs)
- [Hermes MCP guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)
- [Hermes skills documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)
- [Hermes cron documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)

### Configure the MCP server

Add this to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  home-stock-tracker:
    url: 'http://localhost:3000/mcp'
    headers:
      Authorization: 'Bearer <API_AUTH_TOKEN>'
```

Keep the file private. Reload and test the connection:

```text
/reload-mcp
```

```bash
hermes mcp list
hermes mcp test home-stock-tracker
```

Confirm every tool in the installed bundle's `manifest.json.requiredTools` is
discoverable before enabling writes.

### Install the Home Stock Tracker skill

Review and copy the complete bundle:

```bash
mkdir -p ~/.hermes/skills/home-stock-tracker
cp -R integrations/hermes/home-stock-tracker/. \
  ~/.hermes/skills/home-stock-tracker/
```

Restart Hermes or reload skills, then confirm `home-stock-tracker` appears in
the skill list. Start with a read-only prompt:

```text
Which household is this connected to?
```

Hermes should call `get_household_context` once and summarize the returned ID
and composition. Test writes only after confirming the target service and
household. Routine prediction questions must not add this context read.

### Verify the Hermes bundle

From this project checkout, place the service base URL and bearer token in the
two environment variables named by the manifest, then run its generated
verification command:

```bash
npm run agent:probe -- --platform hermes
```

The probe checks health, readiness, authentication, server identity and
compatibility, the exact published schemas and required tools, and one
read-only `get_household_context` call. A successful diagnostic prints only the
agent-safe household ID so the operator can verify the target. It does not print
preferences, policies, credentials, or raw payloads, and it never invokes a
mutation. Keep the token in the process environment or an operator-owned secret
store; never pass it as a command argument.

### WhatsApp and scheduled checks

Hermes owns WhatsApp delivery and scheduling. The service only calculates
recommendations. The repository's dedicated
[Hermes installation and cron guide](../integrations/hermes/home-stock-tracker/README.md)
covers:

- WhatsApp home-channel prerequisites
- proactive stock-check prompts
- the `[SILENT]` empty-result convention
- creating, testing, pausing, and resuming cron jobs
- keeping failed checks visible

The [Hermes scenario matrix](../integrations/hermes/home-stock-tracker/scenarios.md)
contains review cases for every supported conversation.

## OpenClaw

OpenClaw registers Home Stock Tracker as a remote MCP server and installs its
dedicated generated bundle from `integrations/openclaw/home-stock-tracker`.
Shared tool-selection rules come from `integrations/shared/home-stock-tracker`;
platform metadata, installation, runtime, and delivery behavior remain separate.

Official references:

- [OpenClaw documentation](https://docs.openclaw.ai/)
- [OpenClaw MCP guide](https://docs.openclaw.ai/cli/mcp)
- [OpenClaw skills guide](https://docs.openclaw.ai/cli/skills)
- [OpenClaw tools and sandbox policy](https://docs.openclaw.ai/gateway/config-tools)

### Register and probe MCP

Replace the URL and token:

```bash
openclaw mcp set home-stock-tracker \
  '{"url":"http://localhost:3000/mcp","transport":"streamable-http","headers":{"Authorization":"Bearer <API_AUTH_TOKEN>"}}'

openclaw mcp status --verbose
openclaw mcp doctor home-stock-tracker --probe
openclaw mcp show home-stock-tracker --json
```

OpenClaw warns when a sensitive header is stored literally. Keep its state
directory private and use the secret-management mechanism supported by your
deployment. Never put the token in this repository, screenshots, or shared
logs.

If the agent is sandboxed, allow the `bundle-mcp` plugin or the narrower Home
Stock Tracker tool namespace. Otherwise the probe can pass while tools remain
hidden from the model.

### Install the instruction skill

From this repository:

```bash
openclaw skills install \
  ./integrations/openclaw/home-stock-tracker \
  --as home-stock-tracker
```

Use `--global` only when every local OpenClaw agent should see the skill. Use
agent skill allowlists to restrict household access. Start a fresh session if
needed and smoke-test with "What is on the grocery list?" See the dedicated
[OpenClaw installation guide](../integrations/openclaw/home-stock-tracker/README.md)
for workspace scope, tool visibility, reload behavior, and smoke checks.

The OpenClaw bundle intentionally contains no recurring automation or quiet
delivery convention. Configure those separately against the target gateway's
current automation and delivery contracts.

### Verify the OpenClaw bundle

From this project checkout, place the service base URL and bearer token in the
two environment variables named by the manifest, then run its generated
verification command:

```bash
npm run agent:probe -- --platform openclaw
```

Run this repository probe as well as OpenClaw's own doctor command. The former
proves the live server matches the checked-in bundle; the latter proves the
OpenClaw runtime can expose that connection under its sandbox and tool policy.

## Other MCP clients

Any client can integrate when it supports:

- MCP Streamable HTTP
- custom HTTP headers
- initialization and tool discovery
- structured tool results

A typical definition is:

```json
{
  "mcpServers": {
    "home-stock-tracker": {
      "url": "https://inventory.internal.example/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer <API_AUTH_TOKEN>"
      }
    }
  }
}
```

Wrapper property names vary. Follow the client's documentation; the endpoint,
transport, and authorization header remain the same.

For a generic client, select the Hermes or OpenClaw manifest as the portable
contract (their shared MCP requirements are generated from the same source),
then initialize Streamable HTTP, compare server identity/version and
`tools/list` with that manifest and its `mcp.toolsFixture`, and call only
`get_household_context`. The repository probe can perform that generic MCP preflight
without installing either agent skill:

```bash
npm run agent:probe -- --platform hermes
```

Here `--platform` selects a checked-in contract bundle; it does not require the
Hermes application. Do not enable client writes until this preflight succeeds.

If the client supports skills or system instructions, adapt
`integrations/shared/home-stock-tracker/workflow.md`. At minimum retain the
[safe tool workflow](api-reference.md#safe-tool-workflow), especially ID
resolution and uncertain-write handling.

## Integration troubleshooting

The repository probe emits one symbolic diagnostic and stable exit code. It
never prints the configured URL, token, request headers, or raw transport error.

|  Exit | Diagnostic                                                                                           | Operator action                                                                                  |
| ----: | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 10–12 | `MISSING_CONFIGURATION`, `INVALID_CONFIGURATION`, `BUNDLE_INVALID`                                   | Correct the two environment variables or regenerate the complete selected bundle.                |
| 20–24 | `ENDPOINT_UNREACHABLE`, `HEALTH_FAILED`, `READINESS_FAILED`, `AUTHENTICATION_FAILED`, `MCP_DISABLED` | Restore service/network readiness, credentials, or MCP enablement before installing.             |
| 25–28 | `SERVER_IDENTITY_MISMATCH`, `SERVER_VERSION_MISMATCH`, `SCHEMA_DRIFT`, `HIDDEN_TOOLS`                | Select a compatible complete bundle or correct the client/tool policy; do not enable writes.     |
| 29–31 | `SAFE_READ_FAILED`, `MCP_CONNECTION_FAILED`, `INTERNAL_FAILURE`                                      | Confirm household setup, diagnose the read path, or regenerate the bundle; do not enable writes. |

### The client receives `401`

- Send exactly one `Authorization` header.
- Use `Bearer <token>` without commas or extra whitespace.
- Match `API_AUTH_TOKEN` exactly and restart after changing it.

### The client receives `404`

Set `MCP_ENABLED=true` exactly and restart the service. An unauthenticated call
receives `401` before the enablement check.

### The client cannot connect

- Use `/mcp`, not `/api/v1/mcp`.
- Confirm Streamable HTTP support rather than only stdio or SSE.
- Test reachability from the agent's process or container.
- Attach the bearer header to initialization and later requests.
- Use the client's MCP probe or doctor command.

### The connection works but tools are missing

- Check client tool filters and allowlists.
- Check OpenClaw sandbox/plugin policy when applicable.
- Reload MCP connections or start a fresh session.
- Compare discovery with `manifest.json.requiredTools` and the bundled fixture.

## Release, version, and rollback policy

`integrations/shared/home-stock-tracker/release-contract.json` is the only
authored source for service, MCP-contract, skill, compatibility, feature, and
required-tool release metadata. Run `npm run skills:generate` after changing it
and `npm run contract:check` before publishing. Generated manifests, release
guides, skill frontmatter, runtime constants, package versions, schema fixtures,
and scenario guides must be committed together.

Apply the manifest's `mcp.versionPolicy`: increment the MCP contract major for
breaking tool/schema changes, minor for additive contract changes, and patch
for non-contract corrections. A released versioned tool fixture is immutable;
capture contract changes under a new contract version. Adjust the skill version
and compatible MCP range in the same canonical contract whenever instructions
or compatibility change.

To roll back, select a previously committed release or tag whose manifest range
accepts the deployed MCP contract. Restore the entire platform bundle—including
`SKILL.md`, `scenarios.md`, `manifest.json`, `release/README.md`, and the
versioned fixture—then run the manifest's probe command before making it active.
Never combine files from different bundle versions, rewrite a released fixture,
or downgrade only the service or skill side. If no compatible pair is
available, restore the previous service release and its complete bundle as one
deployment change.
