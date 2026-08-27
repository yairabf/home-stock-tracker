import type { CanActivate } from '@nestjs/common';

export const AUTH_TEST_BYPASS: CanActivate = {
  canActivate: () => true,
};
