import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Agent = { name: string; domain: string };

type AgentRow = { name: string; role: string };

@Injectable()
export class MissionService {
  private readonly supabase?: SupabaseClient;
  private readonly agents: Agent[] = [
    { name: 'Product Strategist', domain: 'Discovery, roadmap y priorización' },
    { name: 'Legal Guardian', domain: 'Riesgo legal, contratos y compliance' },
    { name: 'Marketing Ops', domain: 'Go-to-market y growth' },
    { name: 'UX/UI Designer', domain: 'Flujos, prototipos y diseño' },
    { name: 'Software Engineer', domain: 'Arquitectura e implementación' },
    { name: 'QA Lead', domain: 'Pruebas, calidad y release readiness' }
  ];

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
  }

  async listAgents(): Promise<Agent[]> {
    if (!this.supabase) {
      return this.agents;
    }

    const { data, error } = await this.supabase
      .from('agents')
      .select('name,role')
      .order('created_at', { ascending: true });

    if (error || !data) {
      return this.agents;
    }

    return data.map((agent: AgentRow) => ({
      name: agent.name,
      domain: agent.role
    }));
  }

  async addAgent(agent: Agent): Promise<Agent> {
    if (!this.supabase) {
      this.agents.push(agent);
      return agent;
    }

    const { data, error } = await this.supabase
      .from('agents')
      .insert({
        name: agent.name,
        role: agent.domain,
        automation_level: 'hybrid'
      })
      .select('name,role')
      .single();

    if (error || !data) {
      throw error;
    }

    return {
      name: data.name,
      domain: data.role
    };
  }

  getFallbackAgents(): Agent[] {
    return this.agents;
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
