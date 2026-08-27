import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { createApplicationLogger } from './observability/log-levels';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: createApplicationLogger(),
  });
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'mcp', method: RequestMethod.ALL },
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
