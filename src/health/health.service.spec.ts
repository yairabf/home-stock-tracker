import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports the database as up when the probe succeeds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const service = new HealthService(prisma as unknown as PrismaService);

    await expect(service.checkReadiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports a sanitized database-down result when the probe fails', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(
          new Error('postgresql://user:password@private-host/database'),
        ),
    };
    const service = new HealthService(prisma as unknown as PrismaService);

    const result = await service.checkReadiness();

    expect(result).toEqual({
      status: 'error',
      checks: { database: 'down' },
    });
    expect(JSON.stringify(result)).not.toContain('private-host');
    expect(JSON.stringify(result)).not.toContain('password');
  });
});
