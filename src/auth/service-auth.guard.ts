import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { ServiceAuthConfigService } from './service-auth-config.service';

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(
    private readonly config: ServiceAuthConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const credential = this.getBearerCredential(request);

    if (!credential || !this.config.matches(credential)) {
      throw new UnauthorizedException();
    }

    return true;
  }

  private getBearerCredential(request: Request): string | null {
    const authorizationFields = request.rawHeaders.filter(
      (value, index) =>
        index % 2 === 0 && value.toLowerCase() === 'authorization',
    );
    const authorization = request.headers.authorization;

    if (
      authorizationFields.length !== 1 ||
      typeof authorization !== 'string' ||
      authorization.includes(',')
    ) {
      return null;
    }

    return /^Bearer ([^\s,]+)$/i.exec(authorization)?.[1] ?? null;
  }
}
