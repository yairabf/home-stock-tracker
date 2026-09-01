# Agent Integrations

Home Stock Tracker is an authenticated remote MCP server. This guide covers
[Hermes Agent](#hermes-agent), [OpenClaw](#openclaw), and
[other MCP clients](#other-mcp-clients). Tool contracts are documented in the
[API and MCP reference](api-reference.md#mcp-server).

## Shared prerequisites

1. Start Home Stock Tracker and confirm `/health` and `/ready` succeed.
2. Set `MCP_ENABLED=true` in the service `.env` and restart it.
3. Give the client network access to `http://<service-host>:3000/mcp`.
4. Configure `Authorization: Bearer <API_AUTH_TOKEN>` in the client.
5. Keep the token outside this repository and use HTTPS or private networking
   when traffic leaves the machine.

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
    url: "http://localhost:3000/mcp"
    headers:
      Authorization: "Bearer <API_AUTH_TOKEN>"
```

Keep the file private. Reload and test the connection:

```text
/reload-mcp
```

```bash
hermes mcp list
hermes mcp test home-stock-tracker
```

Confirm all eleven tools from the [MCP reference](api-reference.md#tools) are
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
What is on the grocery list?
```

Hermes should call `grocery_list` and summarize the structured result. Test
writes only after confirming the target service and household.

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

OpenClaw can register Home Stock Tracker as a remote MCP server and reuse the
same instruction bundle. The skill body is agent-neutral despite its repository
location under `integrations/hermes`.

Official references:

- [OpenClaw documentation](https://docs.openclaw.ai/)
- [OpenClaw MCP guide](https://docs.openclaw.ai/cli/mcp)
- [OpenClaw skills guide](https://docs.openclaw.ai/skills)
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
  ./integrations/hermes/home-stock-tracker \
  --as home-stock-tracker
```

Use `--global` only when every local OpenClaw agent should see the skill. Use
agent skill allowlists to restrict household access. Start a fresh session if
needed and smoke-test with "What is on the grocery list?"

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

If the client supports skills or system instructions, adapt
`integrations/hermes/home-stock-tracker/SKILL.md`. At minimum retain the
[safe tool workflow](api-reference.md#safe-tool-workflow), especially ID
resolution and uncertain-write handling.

## Integration troubleshooting

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
- Confirm all eleven tools are returned.
