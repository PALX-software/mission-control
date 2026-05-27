import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AgentController } from './mission.controller';
import { MissionService } from './mission.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [AgentController, HealthController],
  providers: [MissionService],
})
class AppModule {}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });

  const allowedOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({ origin: allowedOrigin, methods: ['GET', 'POST'] });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Mission Control API')
      .setDescription('Agent routing and delegation API')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Backend running on port ${port}`);
}

void bootstrap();
