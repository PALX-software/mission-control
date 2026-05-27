import { NestFactory } from '@nestjs/core';
import { Controller, Get, Module, Render } from '@nestjs/common';
import { join } from 'path';

@Controller()
class WebController {
  @Get()
  @Render('index')
  index() {
    return {
      apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001/api'
    };
  }
}

@Module({
  controllers: [WebController]
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');
  app.useStaticAssets(join(__dirname, '..', 'public'));
  await app.listen(3000);
}

void bootstrap();
