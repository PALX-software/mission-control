import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      service: 'mission-control-backend',
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }
}
