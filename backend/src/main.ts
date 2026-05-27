import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AgentController } from './mission.controller';
import { MissionService } from './mission.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [AgentController, HealthController],
  providers: [MissionService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(3001);
}

void bootstrap();
