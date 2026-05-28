insert into public.agents (name, role, automation_level)
select * from (values
  ('Product Strategist', 'Discovery, roadmap y priorizacion', 'hybrid'),
  ('Legal Guardian', 'Riesgo legal, contratos y compliance', 'hybrid'),
  ('Marketing Ops', 'Go-to-market y growth', 'hybrid'),
  ('UX/UI Designer', 'Flujos, prototipos y diseno', 'hybrid'),
  ('Software Engineer', 'Arquitectura e implementacion', 'hybrid'),
  ('QA Lead', 'Pruebas, calidad y release readiness', 'hybrid')
) as seed(name, role, automation_level)
where not exists (select 1 from public.agents where agents.name = seed.name);

insert into public.projects (
  name,
  objective,
  scope_definition,
  audience,
  constraints,
  risk_level,
  discovery_mode,
  github_repo,
  prompt_blueprint
)
select
  'Mission Control Starter',
  'Orquestar equipos multi-agente para discovery, build y release',
  'Panel de proyectos, definicion de scope, outputs, integracion GitHub y planificacion de agentes',
  'Equipos de producto y tecnologia',
  'MVP en 8 semanas con controles legales y auditoria',
  'medium',
  true,
  'https://github.com/PALX-software/mission-control',
  'Proyecto: Mission Control Starter\nObjetivo: Orquestacion multi-agente\nInstruccion: definir plan incremental por fases'
where not exists (select 1 from public.projects where name = 'Mission Control Starter');
