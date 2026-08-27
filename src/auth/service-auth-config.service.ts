import { Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ServiceAuthConfigService {
  private readonly token: Buffer;

  constructor() {
    const configuredToken = process.env.API_AUTH_TOKEN;

    if (!configuredToken || configuredToken.trim() !== configuredToken) {
      throw new Error(
        'API_AUTH_TOKEN must be a non-blank value without surrounding whitespace',
      );
    }

    this.token = Buffer.from(configuredToken);
  }

  matches(candidate: string): boolean {
    const candidateToken = Buffer.from(candidate);

    if (candidateToken.length !== this.token.length) {
      return false;
    }

    return timingSafeEqual(candidateToken, this.token);
  }
}
