import { Body, Controller, Get, Post } from '@nestjs/common';
import { MissionService } from './mission.service';

@Controller('api')
export class AgentController {
  constructor(private readonly missionService: MissionService) {}

  @Get('agents')
  getAgents() {
    return this.missionService.listAgents();
  }

  @Post('agents')
  createAgent(@Body() payload: { name: string; domain: string }) {
    return this.missionService.addAgent(payload);
  }

  @Post('delegate')
  delegate(@Body() payload: { initiative: string }) {
    return {
      initiative: payload.initiative,
      delegatedTo: this.missionService.suggestDelegation(payload.initiative)
    };
  }
}
