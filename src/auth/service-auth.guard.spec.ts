import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ServiceAuthConfigService } from './service-auth-config.service';
import { ServiceAuthGuard } from './service-auth.guard';

describe('ServiceAuthGuard', () => {
  const token = 'configured-token';
  let guard: ServiceAuthGuard;

  beforeEach(() => {
    process.env.API_AUTH_TOKEN = token;
    guard = new ServiceAuthGuard(new ServiceAuthConfigService());
  });

  afterEach(() => {
    delete process.env.API_AUTH_TOKEN;
  });

  it.each([
    ['missing header', undefined, []],
    [
      'wrong scheme',
      'Basic configured-token',
      ['Authorization', 'Basic configured-token'],
    ],
    ['empty credential', 'Bearer ', ['Authorization', 'Bearer ']],
    [
      'credential whitespace',
      'Bearer configured token',
      ['Authorization', 'Bearer configured token'],
    ],
    [
      'comma-joined values',
      'Bearer configured-token, Bearer configured-token',
      ['Authorization', 'Bearer configured-token, Bearer configured-token'],
    ],
    [
      'wrong credential',
      'Bearer wrong-token',
      ['Authorization', 'Bearer wrong-token'],
    ],
    [
      'duplicate fields',
      'Bearer configured-token',
      [
        'Authorization',
        'Bearer configured-token',
        'authorization',
        'Bearer configured-token',
      ],
    ],
  ])('rejects a %s', (_case, authorization, rawHeaders) => {
    const context = createContext(authorization, rawHeaders);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    try {
      guard.canActivate(context);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(token);
      expect(JSON.stringify(error)).not.toContain('wrong-token');
    }
  });

  it.each(['Bearer', 'bearer', 'BEARER'])(
    'accepts the configured token with a %s scheme',
    (scheme) => {
      const authorization = `${scheme} ${token}`;

      expect(
        guard.canActivate(
          createContext(authorization, ['Authorization', authorization]),
        ),
      ).toBe(true);
    },
  );
});

function createContext(
  authorization: string | undefined,
  rawHeaders: string[],
): ExecutionContext {
  const request = {
    headers: { authorization },
    rawHeaders,
  } as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}
