import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MissionService } from './mission.service';
import { CreateAgentDto, DelegateDto } from './mission.dto';

@Controller('api')
export class AgentController {
  constructor(private readonly missionService: MissionService) {}

  @Get('agents')
  getAgents() {
    return this.missionService.listAgents();
  }

  @Post('agents')
  createAgent(@Body() dto: CreateAgentDto) {
    return this.missionService.addAgent(dto);
  }

  @Post('delegate')
  @HttpCode(200)
  delegate(@Body() dto: DelegateDto) {
    return {
      initiative: dto.initiative,
      delegatedTo: this.missionService.suggestDelegation(dto.initiative),
    };
  }
}
