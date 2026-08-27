import { Module } from '@nestjs/common';
import { ServiceAuthConfigService } from './service-auth-config.service';
import { ServiceAuthGuard } from './service-auth.guard';

@Module({
  providers: [ServiceAuthConfigService, ServiceAuthGuard],
  exports: [ServiceAuthGuard],
})
export class ServiceAuthModule {}
