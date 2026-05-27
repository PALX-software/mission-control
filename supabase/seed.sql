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
values (
  'Mission Control Starter',
  'Orquestar equipos multi-agente para discovery, build y release',
  'Panel de proyectos, definición de scope, outputs, integración GitHub y planificación de agentes',
  'Equipos de producto y tecnología',
  'MVP en 8 semanas con controles legales y auditoría',
  'medium',
  true,
  'https://github.com/example/mission-control',
  'Proyecto: Mission Control Starter\nObjetivo: Orquestación multi-agente\nInstrucción: definir plan incremental por fases'
)
on conflict do nothing;
