import { describe, expect, it, beforeEach } from 'vitest';
import { MissionService } from './mission.service';

describe('MissionService', () => {
  let service: MissionService;

  beforeEach(() => {
    service = new MissionService();
  });

  describe('listAgents', () => {
    it('returns the default 6 agents', () => {
      expect(service.listAgents()).toHaveLength(6);
    });

    it('includes Product Strategist', () => {
      const names = service.listAgents().map((a) => a.name);
      expect(names).toContain('Product Strategist');
    });
  });

  describe('addAgent', () => {
    it('adds a new agent and returns it', () => {
      const agent = service.addAgent({ name: 'Data Analyst', domain: 'Analytics' });
      expect(agent).toEqual({ name: 'Data Analyst', domain: 'Analytics' });
      expect(service.listAgents()).toHaveLength(7);
    });
  });

  describe('suggestDelegation', () => {
    it('always includes base agents', () => {
      const result = service.suggestDelegation('launch a new product');
      expect(result).toContain('Product Strategist');
      expect(result).toContain('Software Engineer');
      expect(result).toContain('QA Lead');
    });

    it('adds Legal Guardian for "legal" keyword', () => {
      expect(service.suggestDelegation('review legal requirements')).toContain('Legal Guardian');
    });

    it('adds Legal Guardian for "contrato" keyword (Spanish)', () => {
      expect(service.suggestDelegation('revisar el contrato')).toContain('Legal Guardian');
    });

    it('adds Legal Guardian for "contract" keyword (English)', () => {
      expect(service.suggestDelegation('sign a new contract')).toContain('Legal Guardian');
    });

    it('adds Marketing Ops for "campaign" keyword', () => {
      expect(service.suggestDelegation('launch email campaign')).toContain('Marketing Ops');
    });

    it('adds Marketing Ops for "campaña" keyword (Spanish)', () => {
      expect(service.suggestDelegation('crear campaña de email')).toContain('Marketing Ops');
    });

    it('adds UX/UI Designer for "design" keyword', () => {
      expect(service.suggestDelegation('improve design of onboarding')).toContain('UX/UI Designer');
    });

    it('adds UX/UI Designer for "diseño" keyword (Spanish)', () => {
      expect(service.suggestDelegation('mejorar el diseño')).toContain('UX/UI Designer');
    });

    it('returns unique agents', () => {
      const result = service.suggestDelegation('legal contract design ui ux compliance');
      expect(result.length).toBe(new Set(result).size);
    });
  });
});
