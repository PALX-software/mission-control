import { Injectable } from '@nestjs/common';

export type Agent = { name: string; domain: string };

const ROUTING_RULES: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /legal|compliance|contrato|riesgo|contract|risk|gdpr|privacy|privacidad/, agent: 'Legal Guardian' },
  { pattern: /go-to-market|growth|campaña|ads|seo|campaign|marketing/, agent: 'Marketing Ops' },
  { pattern: /flujo|ui|ux|diseño|experiencia|design|flow|prototype|wireframe/, agent: 'UX/UI Designer' },
];

@Injectable()
export class MissionService {
  private readonly agents: Agent[] = [
    { name: 'Product Strategist', domain: 'Discovery, roadmap y priorización' },
    { name: 'Legal Guardian', domain: 'Riesgo legal, contratos y compliance' },
    { name: 'Marketing Ops', domain: 'Go-to-market y growth' },
    { name: 'UX/UI Designer', domain: 'Flujos, prototipos y diseño' },
    { name: 'Software Engineer', domain: 'Arquitectura e implementación' },
    { name: 'QA Lead', domain: 'Pruebas, calidad y release readiness' },
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

    for (const { pattern, agent } of ROUTING_RULES) {
      if (pattern.test(signal)) picks.add(agent);
    }

    return Array.from(picks);
  }
}
