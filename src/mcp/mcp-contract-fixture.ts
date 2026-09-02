import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Implementation, Tool } from '@modelcontextprotocol/sdk/types.js';

export interface McpContractSnapshot {
  serverInfo: Implementation;
  tools: Tool[];
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeJson(entry)]),
    );
  }
  return value;
}

export function normalizeMcpContractSnapshot(
  serverInfo: Implementation,
  tools: Tool[],
): McpContractSnapshot {
  const serialized: unknown = JSON.parse(
    JSON.stringify({
      serverInfo,
      tools: [...tools].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    }),
  );
  return normalizeJson(serialized) as McpContractSnapshot;
}

export async function discoverMcpContractSnapshot(
  client: Client,
): Promise<McpContractSnapshot> {
  const serverInfo = client.getServerVersion();
  if (!serverInfo) {
    throw new Error('MCP initialization did not publish server information');
  }
  const { tools } = await client.listTools();
  return normalizeMcpContractSnapshot(serverInfo, tools);
}

export function readMcpContractSnapshot(path: string): McpContractSnapshot {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return parsed as McpContractSnapshot;
}

export function writeNewMcpContractSnapshot(
  path: string,
  snapshot: McpContractSnapshot,
): void {
  if (existsSync(path)) {
    throw new Error(
      `Refusing to overwrite released MCP contract fixture: ${path}`,
    );
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}
