import {
  Controller,
  Get,
  type INestApplication,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ServiceAuthConfigService } from '../auth/service-auth-config.service';
import { ServiceAuthGuard } from '../auth/service-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Controller('protected')
class ProtectedController {
  @Get()
  getProtected(): string {
    return 'protected';
  }
}

describe('health HTTP contract', () => {
  let app: INestApplication<App>;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    process.env.API_AUTH_TOKEN = 'health-test-token';
    const module = await Test.createTestingModule({
      controllers: [HealthController, ProtectedController],
      providers: [
        HealthService,
        ServiceAuthConfigService,
        ServiceAuthGuard,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: APP_GUARD, useExisting: ServiceAuthGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'ready', method: RequestMethod.GET },
      ],
    });
    await app.init();
  });

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);
  });

  afterAll(async () => {
    delete process.env.API_AUTH_TOKEN;
    await app.close();
  });

  it('exposes unprefixed liveness without authentication', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });

    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('exposes unprefixed database readiness without authentication', async () => {
    await request(app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect({ status: 'ok', checks: { database: 'up' } });

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a sanitized 503 when the database is unavailable', async () => {
    queryRaw.mockRejectedValueOnce(new Error('private database detail'));

    const response = await request(app.getHttpServer())
      .get('/ready')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      checks: { database: 'down' },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'private database detail',
    );
  });

  it('keeps ordinary prefixed routes protected', async () => {
    await request(app.getHttpServer()).get('/api/v1/protected').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/protected')
      .set('Authorization', 'Bearer health-test-token')
      .expect(200)
      .expect('protected');
  });
});
