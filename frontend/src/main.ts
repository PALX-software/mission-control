import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Controller, Get, Logger, Module, Render } from '@nestjs/common';
import { join } from 'path';
import { HealthController } from './health.controller';

@Controller()
class WebController {
  @Get()
  @Render('index')
  index() {
    return {
      apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001/api',
    };
  }
}

@Module({
  controllers: [WebController, HealthController],
})
class AppModule {}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Frontend running on port ${port}`);
}

void bootstrap();
