import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { createApplicationLogger } from './observability/log-levels';
import { loadApplicationConfig } from './config/application-config';

async function bootstrap() {
  const config = loadApplicationConfig();
  const app = await NestFactory.create(AppModule, {
    logger: createApplicationLogger(config.logLevel),
  });
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'mcp', method: RequestMethod.ALL },
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(config.port);
}
void bootstrap();
