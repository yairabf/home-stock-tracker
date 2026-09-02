import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_RELEASE_CONTRACT } from './agent-release-contract.generated';

interface ToolFixture {
  tools: { name: string }[];
}

interface BundleManifest {
  schemaVersion: number;
  platform: 'hermes' | 'openclaw';
  service: { name: string; version: string };
  skill: { name: string; version: string };
  mcp: {
    serverName: string;
    contractVersion: string;
    compatibleRange: string;
    toolsFixture: string;
  };
  requiredTools: string[];
  prerequisites: {
    authentication: { scheme: string; environmentVariable: string };
    network: {
      baseUrlEnvironmentVariable: string;
      healthPath: string;
      readinessPath: string;
      mcpPath: string;
      transport: string;
    };
  };
  verification: { command: string };
  rollback: { strategy: string; guidance: string };
}

describe('portable agent release manifests', () => {
  const root = process.cwd();
  const platforms = ['hermes', 'openclaw'] as const;
  const canonicalFixture = JSON.parse(
    readFileSync(
      join(
        root,
        'integrations/shared/home-stock-tracker',
        AGENT_RELEASE_CONTRACT.mcp.toolsFixture,
      ),
      'utf8',
    ),
  ) as ToolFixture;

  function bundleRoot(platform: (typeof platforms)[number]): string {
    return join(root, 'integrations', platform, 'home-stock-tracker');
  }

  function readManifest(platform: (typeof platforms)[number]): BundleManifest {
    return JSON.parse(
      readFileSync(join(bundleRoot(platform), 'manifest.json'), 'utf8'),
    ) as BundleManifest;
  }

  function verificationCommand(platform: (typeof platforms)[number]): string {
    return AGENT_RELEASE_CONTRACT.bundle.verificationCommand.replace(
      '{{PLATFORM}}',
      platform,
    );
  }

  it.each(platforms)(
    '%s declares the complete portable contract',
    (platform) => {
      const manifest = readManifest(platform);

      expect(manifest).toMatchObject({
        schemaVersion: 1,
        platform,
        service: AGENT_RELEASE_CONTRACT.service,
        skill: {
          name: AGENT_RELEASE_CONTRACT.skill.name,
          version: AGENT_RELEASE_CONTRACT.skill.version,
        },
        mcp: {
          serverName: AGENT_RELEASE_CONTRACT.mcp.serverName,
          contractVersion: AGENT_RELEASE_CONTRACT.mcp.contractVersion,
          compatibleRange: AGENT_RELEASE_CONTRACT.skill.compatibleMcpRange,
          toolsFixture: AGENT_RELEASE_CONTRACT.mcp.toolsFixture,
        },
        requiredTools: AGENT_RELEASE_CONTRACT.requiredTools,
        prerequisites: {
          authentication: AGENT_RELEASE_CONTRACT.bundle.authentication,
          network: AGENT_RELEASE_CONTRACT.bundle.network,
        },
        verification: {
          command: verificationCommand(platform),
        },
        rollback: AGENT_RELEASE_CONTRACT.bundle.rollback,
      });
    },
  );

  it.each(platforms)(
    '%s carries the exact normalized schema fixture required by its manifest',
    (platform) => {
      const manifest = readManifest(platform);
      const bundledFixture = JSON.parse(
        readFileSync(
          join(bundleRoot(platform), manifest.mcp.toolsFixture),
          'utf8',
        ),
      ) as ToolFixture;

      expect(bundledFixture).toEqual(canonicalFixture);
      expect(bundledFixture.tools.map(({ name }) => name)).toEqual(
        expect.arrayContaining(manifest.requiredTools),
      );
    },
  );

  it.each(platforms)(
    '%s generates compatibility, prerequisite, verification, and rollback guidance',
    (platform) => {
      const releaseReadme = readFileSync(
        join(bundleRoot(platform), 'release/README.md'),
        'utf8',
      );

      expect(releaseReadme).toContain(`\`${platform}\` bundle`);
      expect(releaseReadme).toContain(
        `Compatible MCP range: \`${AGENT_RELEASE_CONTRACT.skill.compatibleMcpRange}\``,
      );
      expect(releaseReadme).toContain(
        `\`${AGENT_RELEASE_CONTRACT.bundle.authentication.environmentVariable}\``,
      );
      expect(releaseReadme).toContain(
        `\`${AGENT_RELEASE_CONTRACT.bundle.network.baseUrlEnvironmentVariable}\``,
      );
      expect(releaseReadme).toContain(verificationCommand(platform));
      expect(releaseReadme).toContain(
        AGENT_RELEASE_CONTRACT.bundle.rollback.guidance,
      );
      for (const tool of AGENT_RELEASE_CONTRACT.requiredTools) {
        expect(releaseReadme).toContain(`\`${tool}\``);
      }
    },
  );

  it.each(platforms)(
    '%s frontmatter contains supported identity fields only',
    (platform) => {
      const skill = readFileSync(
        join(bundleRoot(platform), 'SKILL.md'),
        'utf8',
      );
      const frontmatter = skill.split('---')[1];

      expect(frontmatter).toContain(
        `name: ${AGENT_RELEASE_CONTRACT.skill.name}`,
      );
      expect(frontmatter).toContain(
        `description: ${AGENT_RELEASE_CONTRACT.skill.description}`,
      );
      expect(frontmatter).toContain(
        `version: ${AGENT_RELEASE_CONTRACT.skill.version}`,
      );
      expect(frontmatter).toContain(
        `author: ${AGENT_RELEASE_CONTRACT.skill.author}`,
      );
      expect(frontmatter).not.toMatch(
        /compatibleMcpRange|requiredTools|verificationCommand|rollback|platform:/,
      );
      if (platform === 'hermes') {
        expect(frontmatter).toContain('metadata:\n  hermes:');
      } else {
        expect(frontmatter).not.toContain('metadata:');
      }
    },
  );

  it('keeps generated release metadata non-secret and platform-isolated', () => {
    for (const platform of platforms) {
      const releaseMaterial = [
        'manifest.json',
        'release/README.md',
        'README.md',
        'SKILL.md',
        'scenarios.md',
      ]
        .map((path) => readFileSync(join(bundleRoot(platform), path), 'utf8'))
        .join('\n');

      expect(releaseMaterial).not.toMatch(/https?:\/\//i);
      expect(releaseMaterial).not.toMatch(
        /bearer\s+[a-z0-9._-]{12,}|api[_-]?key\s*[:=]\s*\S+/i,
      );
      expect(releaseMaterial).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
      );
      if (platform === 'openclaw') {
        expect(releaseMaterial).not.toMatch(/Hermes|WhatsApp|\[SILENT\]/i);
      } else {
        expect(releaseMaterial).not.toMatch(/OpenClaw/i);
      }
    }
  });
});
