import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AppService } from '../src/app.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Service authentication (e2e)', () => {
  let app: INestApplication<App>;
  const getHello = jest.fn(() => 'Hello authenticated service!');

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AppService)
      .useValue({ getHello })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    getHello.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['a missing header', undefined],
    ['a malformed header', 'Basic e2e-service-token'],
    ['an incorrect credential', 'Bearer wrong-token'],
  ])('rejects %s before invoking the handler', async (_case, authorization) => {
    const pendingRequest = request(app.getHttpServer()).get('/api/v1');
    if (authorization) {
      pendingRequest.set('Authorization', authorization);
    }

    const response = await pendingRequest.expect(401);

    expect(response.body).toEqual({
      message: 'Unauthorized',
      statusCode: 401,
    });
    expect(JSON.stringify(response.body)).not.toContain('e2e-service-token');
    expect(JSON.stringify(response.body)).not.toContain('wrong-token');
    expect(getHello).not.toHaveBeenCalled();
  });

  it('preserves the route response for the configured credential', async () => {
    await request(app.getHttpServer())
      .get('/api/v1')
      .set('Authorization', 'Bearer e2e-service-token')
      .expect(200)
      .expect('Hello authenticated service!');

    expect(getHello).toHaveBeenCalledTimes(1);
  });
});
