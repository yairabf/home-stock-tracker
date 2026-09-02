import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGENT_RELEASE_CONTRACT } from './agent-release-contract.generated';

interface MutableReleaseContract {
  service: { name: string; version: string; apiToken?: string };
  mcp: {
    serverName: string;
    contractVersion: string;
    toolsFixture: string;
    versionPolicy: {
      breaking: string;
      additive: string;
      nonContract: string;
    };
    url?: string;
  };
  skill: {
    name: string;
    description: string;
    version: string;
    compatibleMcpRange: string;
    author: string;
    tags: string[];
  };
  features: string[];
  requiredTools: string[];
  platforms: string[];
  bundle: {
    schemaVersion: number;
    authentication: { scheme: string; environmentVariable: string };
    network: {
      baseUrlEnvironmentVariable: string;
      healthPath: string;
      readinessPath: string;
      mcpPath: string;
      transport: string;
    };
    verificationCommand: string;
    rollback: { strategy: string; guidance: string };
  };
}

interface PackageManifest {
  version: string;
}

interface PackageLockManifest extends PackageManifest {
  packages: Record<string, PackageManifest>;
}

describe('agent release contract', () => {
  const projectRoot = process.cwd();
  const validator = join(projectRoot, 'scripts/agent-release-contract.mjs');
  const generator = join(projectRoot, 'scripts/generate-agent-skills.mjs');

  function mutableContract(): MutableReleaseContract {
    const parsed: unknown = JSON.parse(JSON.stringify(AGENT_RELEASE_CONTRACT));
    return parsed as MutableReleaseContract;
  }

  function readJson<T>(path: string): T {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed as T;
  }

  function validate(contract: MutableReleaseContract) {
    const temporaryRoot = mkdtempSync(
      join(tmpdir(), 'agent-release-contract-'),
    );
    const contractPath = join(temporaryRoot, 'release-contract.json');
    writeFileSync(contractPath, JSON.stringify(contract));

    try {
      return spawnSync(process.execPath, [validator, contractPath], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }

  it('accepts the canonical release contract and keeps generated files current', () => {
    const validation = validate(mutableContract());
    const generation = spawnSync(process.execPath, [generator, '--check'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(validation.status).toBe(0);
    expect(validation.stdout).toBe('Release contract is valid.\n');
    expect(generation.status).toBe(0);
    expect(generation.stderr).toBe('');
  });

  it.each([
    [
      'service.version',
      (contract: MutableReleaseContract) => {
        contract.service.version = 'v1';
      },
    ],
    [
      'mcp.contractVersion',
      (contract: MutableReleaseContract) => {
        contract.mcp.contractVersion = '1.0';
      },
    ],
    [
      'skill.version',
      (contract: MutableReleaseContract) => {
        contract.skill.version = 'latest';
      },
    ],
  ])('rejects malformed %s', (_, mutate) => {
    const contract = mutableContract();
    mutate(contract);

    const result = validate(contract);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must be a stable semantic version');
  });

  it('rejects unsupported and incompatible MCP ranges', () => {
    const unsupported = mutableContract();
    unsupported.skill.compatibleMcpRange = '^1.0.0';
    const incompatible = mutableContract();
    incompatible.skill.compatibleMcpRange = '>=2.0.0 <3.0.0';

    expect(validate(unsupported).stderr).toContain(
      'must use the format >=x.y.z <x.y.z',
    );
    expect(validate(incompatible).stderr).toContain(
      'outside skill.compatibleMcpRange',
    );
  });

  it('rejects a weakened MCP version-bump policy', () => {
    const contract = mutableContract();
    contract.mcp.versionPolicy.additive = 'patch';

    const result = validate(contract);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('mcp.versionPolicy.additive must be minor');
  });

  it('rejects drift in portable authentication and verification prerequisites', () => {
    const authentication = mutableContract();
    authentication.bundle.authentication.environmentVariable =
      'INLINE_CREDENTIAL';
    const verification = mutableContract();
    verification.bundle.verificationCommand = 'curl a deployment';

    expect(validate(authentication).stderr).toContain(
      'bundle.authentication must use the documented environment variable',
    );
    expect(validate(verification).stderr).toContain(
      'bundle.verificationCommand must be the platform probe template',
    );
  });

  it.each([
    [
      'features',
      (contract: MutableReleaseContract) => {
        contract.features.push(contract.features[0]);
      },
    ],
    [
      'requiredTools',
      (contract: MutableReleaseContract) => {
        contract.requiredTools.push(contract.requiredTools[0]);
      },
    ],
  ])('rejects duplicate %s identifiers', (_, mutate) => {
    const contract = mutableContract();
    mutate(contract);

    const result = validate(contract);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('contains duplicate identifier');
  });

  it.each([
    [
      'secret',
      (contract: MutableReleaseContract) => {
        contract.service.apiToken = 'do-not-store-this';
      },
    ],
    [
      'deployment URL',
      (contract: MutableReleaseContract) => {
        contract.mcp.url = 'https://inventory.example/mcp';
      },
    ],
  ])('rejects a %s field without echoing its value', (_, mutate) => {
    const contract = mutableContract();
    mutate(contract);

    const result = validate(contract);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('forbidden secret or deployment field');
    expect(result.stderr).not.toContain('do-not-store-this');
    expect(result.stderr).not.toContain('inventory.example');
  });

  it('derives package, runtime, and platform skill versions from one source', () => {
    const packageJson = readJson<PackageManifest>(
      join(projectRoot, 'package.json'),
    );
    const packageLock = readJson<PackageLockManifest>(
      join(projectRoot, 'package-lock.json'),
    );
    const hermesSkill = readFileSync(
      join(projectRoot, 'integrations/hermes/home-stock-tracker/SKILL.md'),
      'utf8',
    );
    const openClawSkill = readFileSync(
      join(projectRoot, 'integrations/openclaw/home-stock-tracker/SKILL.md'),
      'utf8',
    );

    expect(packageJson.version).toBe(AGENT_RELEASE_CONTRACT.service.version);
    expect(packageLock.version).toBe(AGENT_RELEASE_CONTRACT.service.version);
    expect(packageLock.packages[''].version).toBe(
      AGENT_RELEASE_CONTRACT.service.version,
    );
    expect(hermesSkill).toContain(
      `version: ${AGENT_RELEASE_CONTRACT.skill.version}`,
    );
    expect(openClawSkill).toContain(
      `version: ${AGENT_RELEASE_CONTRACT.skill.version}`,
    );
  });
});
