import { Test } from '@nestjs/testing';
import { ServiceAuthConfigService } from './service-auth-config.service';
import { ServiceAuthModule } from './service-auth.module';

describe('ServiceAuthConfigService', () => {
  const originalToken = process.env.API_AUTH_TOKEN;

  afterEach(() => {
    restoreToken(originalToken);
  });

  it.each([undefined, '', '   ', ' token', 'token '])(
    'fails module startup for invalid API_AUTH_TOKEN %p',
    async (token) => {
      restoreToken(token);

      await expect(
        Test.createTestingModule({ imports: [ServiceAuthModule] }).compile(),
      ).rejects.toThrow(
        'API_AUTH_TOKEN must be a non-blank value without surrounding whitespace',
      );
    },
  );

  it('matches only the configured token', () => {
    process.env.API_AUTH_TOKEN = 'configured-token';
    const config = new ServiceAuthConfigService();

    expect(config.matches('configured-token')).toBe(true);
    expect(config.matches('wrong-token')).toBe(false);
    expect(config.matches('configured-token-with-extra-length')).toBe(false);
  });
});

function restoreToken(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.API_AUTH_TOKEN;
  } else {
    process.env.API_AUTH_TOKEN = value;
  }
}
