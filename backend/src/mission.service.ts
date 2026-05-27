import { Injectable } from '@nestjs/common';

export type Agent = { name: string; domain: string };

@Injectable()
export class MissionService {
  private readonly agents: Agent[] = [
    { name: 'Product Strategist', domain: 'Discovery, roadmap y priorización' },
    { name: 'Legal Guardian', domain: 'Riesgo legal, contratos y compliance' },
    { name: 'Marketing Ops', domain: 'Go-to-market y growth' },
    { name: 'UX/UI Designer', domain: 'Flujos, prototipos y diseño' },
    { name: 'Software Engineer', domain: 'Arquitectura e implementación' },
    { name: 'QA Lead', domain: 'Pruebas, calidad y release readiness' }
  ];

  listAgents(): Agent[] {
    return this.agents;
  }

  addAgent(agent: Agent): Agent {
    this.agents.push(agent);
    return agent;
  }

  suggestDelegation(text: string): string[] {
    const signal = text.toLowerCase();
    const picks = new Set(['Product Strategist', 'Software Engineer', 'QA Lead']);

    if (/legal|compliance|contrato|riesgo/.test(signal)) picks.add('Legal Guardian');
    if (/go-to-market|growth|campaña|ads|seo/.test(signal)) picks.add('Marketing Ops');
    if (/flujo|ui|ux|diseño|experiencia/.test(signal)) picks.add('UX/UI Designer');

    return Array.from(picks);
  }
}
