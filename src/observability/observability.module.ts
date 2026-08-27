import { Global, Module } from '@nestjs/common';
import { OperationalLogger } from './operational-logger.service';

@Global()
@Module({
  providers: [OperationalLogger],
  exports: [OperationalLogger],
})
export class ObservabilityModule {}
