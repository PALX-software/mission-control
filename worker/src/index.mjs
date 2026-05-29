const fallbackAgents = [
  { name: 'Product Strategist', domain: 'Discovery, roadmap y priorizacion' },
  { name: 'Legal Guardian', domain: 'Riesgo legal, contratos y compliance' },
  { name: 'Marketing Ops', domain: 'Go-to-market y growth' },
  { name: 'UX/UI Designer', domain: 'Flujos, prototipos y diseno' },
  { name: 'Software Engineer', domain: 'Arquitectura e implementacion' },
  { name: 'QA Lead', domain: 'Pruebas, calidad y release readiness' }
];

const fallbackMissions = [];
const fallbackProjects = [];
const stages = ['discover', 'plan', 'build', 'validate', 'launch'];
const riskLevels = ['low', 'medium', 'high'];
const taskStatuses = ['queued', 'running', 'blocked', 'done'];
const taskPriorities = ['low', 'medium', 'high', 'critical'];
const projectStatuses = ['active', 'paused', 'done', 'archived'];
const frameworks = [
  'cloudflare-worker-supabase',
  'nextjs-supabase',
  'react-vite-supabase',
  'nestjs-supabase',
  'expo-supabase',
  'python-fastapi-supabase'
];
const outputTypes = ['doc', 'code', 'qa_report', 'legal_review', 'launch_asset'];
const defaultOpenAiModel = 'chat-latest';
const defaultProjectRepo = 'https://github.com/PALX-software/mission-control';
const defaultGithubOrg = 'PALX-software';
const defaultCloudflareZone = 'zeqhora.com';

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,apikey,x-mission-control-token',
      ...init.headers
    }
  });
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getSupabase(env) {
  const key =
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY;

  if (!env.SUPABASE_URL || !key) {
    return undefined;
  }

  return {
    url: env.SUPABASE_URL.replace(/\/$/, ''),
    key
  };
}

async function supabaseFetch(env, path, init = {}) {
  const supabase = getSupabase(env);

  if (!supabase) {
    return undefined;
  }

  const response = await fetch(`${supabase.url}${path}`, {
    ...init,
    headers: {
      apikey: supabase.key,
      authorization: `Bearer ${supabase.key}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...init.headers
    }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(body || `Supabase request failed with ${response.status}`);
  }

  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function safeSupabaseFetch(env, path, init = {}) {
  try {
    return await supabaseFetch(env, path, init);
  } catch {
    return undefined;
  }
}

function getOpenAi(env) {
  const key = env.OPENAI_API_KEY || env.OPENAI_SECRET_KEY;

  if (!key) {
    return undefined;
  }

  return {
    key,
    model: env.OPENAI_MODEL || defaultOpenAiModel
  };
}

function getOperatorToken(request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || request.headers.get('x-mission-control-token') || '';
}

function guardOperator(request, env) {
  if (!env.MISSION_CONTROL_OPERATOR_TOKEN) {
    return undefined;
  }

  if (getOperatorToken(request) === env.MISSION_CONTROL_OPERATOR_TOKEN) {
    return undefined;
  }

  return json(
    {
      error: 'operator token required'
    },
    {
      status: 401,
      headers: { 'www-authenticate': 'Bearer' }
    }
  );
}

async function listAgents(env) {
  const data = await safeSupabaseFetch(
    env,
    '/rest/v1/agents?select=name,role&order=created_at.asc'
  );

  if (!Array.isArray(data)) {
    return fallbackAgents;
  }

  return data.map((agent) => ({
    name: agent.name,
    domain: agent.role
  }));
}

async function addAgent(env, agent) {
  if (!agent?.name || !agent?.domain) {
    return json({ error: 'name and domain are required' }, { status: 400 });
  }

  const row = {
    name: normalizeText(agent.name),
    role: normalizeText(agent.domain),
    automation_level: normalizeEnum(agent.automationLevel, ['auto', 'hybrid', 'manual'], 'hybrid')
  };

  if (!getSupabase(env)) {
    const created = { name: row.name, domain: row.role };
    fallbackAgents.push(created);
    return json(created, { status: 201 });
  }

  const data = await supabaseFetch(env, '/rest/v1/agents?select=name,role', {
    method: 'POST',
    body: JSON.stringify(row)
  });

  return json(
    {
      name: data[0].name,
      domain: data[0].role
    },
    { status: 201 }
  );
}

function suggestDelegation(text = '') {
  const signal = text.toLowerCase();
  const picks = new Set(['Product Strategist', 'Software Engineer', 'QA Lead']);

  if (/legal|compliance|contract|contrato|risk|riesgo/.test(signal)) {
    picks.add('Legal Guardian');
  }
  if (/go-to-market|growth|campana|campaign|ads|seo|launch|lanzamiento/.test(signal)) {
    picks.add('Marketing Ops');
  }
  if (/flow|flujo|ui|ux|design|diseno|experiencia/.test(signal)) {
    picks.add('UX/UI Designer');
  }

  return Array.from(picks);
}

function findAgent(agents, name) {
  return agents.find((agent) => agent.name.toLowerCase() === String(name).toLowerCase());
}

function fallbackPlan(payload, agents) {
  const title = normalizeText(payload.title, 'Nueva iniciativa');
  const scope = normalizeText(payload.scope || payload.scopeText || payload.initiative, title);
  const stage = normalizeEnum(payload.stage, stages, 'plan');
  const riskLevel = normalizeEnum(payload.riskLevel || payload.risk_level, riskLevels, 'medium');
  const selectedAgents = suggestDelegation(`${title} ${scope}`)
    .map((name) => findAgent(agents, name) || { name, domain: 'Operacion general' });

  return {
    summary: `Plan operativo inicial para ${title}.`,
    stage,
    riskLevel,
    delegatedTo: selectedAgents.map((agent) => ({
      agent: agent.name,
      role: agent.domain,
      why: `Necesario para cubrir ${agent.domain}.`,
      status: 'queued',
      nextAction: `Preparar entregable inicial de ${agent.name}.`
    })),
    plan: [
      {
        title: 'Alinear alcance y objetivo',
        owner: 'Product Strategist',
        detail: 'Convertir el objetivo en criterios de exito, restricciones y decisiones abiertas.',
        status: 'queued'
      },
      {
        title: 'Disenar flujo operativo',
        owner: selectedAgents.some((agent) => agent.name === 'UX/UI Designer')
          ? 'UX/UI Designer'
          : 'Software Engineer',
        detail: 'Mapear pantallas, datos, integraciones y puntos de control.',
        status: 'queued'
      },
      {
        title: 'Implementar incremento principal',
        owner: 'Software Engineer',
        detail: 'Construir la primera version verificable con trazabilidad de cambios.',
        status: 'queued'
      },
      {
        title: 'Validar release',
        owner: 'QA Lead',
        detail: 'Ejecutar validacion funcional, riesgos y readiness para produccion.',
        status: 'queued'
      }
    ],
    acceptanceCriteria: [
      'La iniciativa tiene owner, alcance y criterios de salida claros.',
      'Cada agente tiene una siguiente accion concreta.',
      'El release puede validarse con healthcheck y evidencia de pruebas.'
    ],
    blockers: riskLevel === 'high' ? ['Requiere revision legal y validacion de riesgo antes de produccion.'] : [],
    outputs: [
      {
        name: 'Project brief',
        outputType: 'doc',
        definition: 'Resumen de objetivo, alcance, decisiones y criterios de salida.',
        status: 'queued'
      },
      {
        name: 'Implementation backlog',
        outputType: 'code',
        definition: 'Lista priorizada de tareas tecnicas con owners.',
        status: 'queued'
      },
      {
        name: 'QA readiness report',
        outputType: 'qa_report',
        definition: 'Validacion funcional y riesgos antes del despliegue.',
        status: 'queued'
      }
    ],
    source: 'fallback',
    aiStatus: 'fallback',
    aiError: undefined
  };
}

function missionPlanSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'stage',
      'riskLevel',
      'delegatedTo',
      'plan',
      'acceptanceCriteria',
      'blockers',
      'outputs'
    ],
    properties: {
      summary: { type: 'string' },
      stage: { type: 'string', enum: stages },
      riskLevel: { type: 'string', enum: riskLevels },
      delegatedTo: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['agent', 'role', 'why', 'status', 'nextAction'],
          properties: {
            agent: { type: 'string' },
            role: { type: 'string' },
            why: { type: 'string' },
            status: { type: 'string', enum: taskStatuses },
            nextAction: { type: 'string' }
          }
        }
      },
      plan: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'owner', 'detail', 'status'],
          properties: {
            title: { type: 'string' },
            owner: { type: 'string' },
            detail: { type: 'string' },
            status: { type: 'string', enum: taskStatuses }
          }
        }
      },
      acceptanceCriteria: {
        type: 'array',
        items: { type: 'string' }
      },
      blockers: {
        type: 'array',
        items: { type: 'string' }
      },
      outputs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'outputType', 'definition', 'status'],
          properties: {
            name: { type: 'string' },
            outputType: { type: 'string', enum: outputTypes },
            definition: { type: 'string' },
            status: { type: 'string', enum: taskStatuses }
          }
        }
      }
    }
  };
}

function missionRunSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'brief',
      'status',
      'learningSummary',
      'decisions',
      'newFacts',
      'completedSteps',
      'updatedSteps',
      'nextActions',
      'risks',
      'artifacts'
    ],
    properties: {
      brief: { type: 'string' },
      status: { type: 'string', enum: ['running', 'blocked', 'done'] },
      learningSummary: { type: 'string' },
      decisions: {
        type: 'array',
        items: { type: 'string' }
      },
      newFacts: {
        type: 'array',
        items: { type: 'string' }
      },
      completedSteps: {
        type: 'array',
        items: { type: 'string' }
      },
      updatedSteps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['stepTitle', 'status', 'note'],
          properties: {
            stepTitle: { type: 'string' },
            status: { type: 'string', enum: taskStatuses },
            note: { type: 'string' }
          }
        }
      },
      nextActions: {
        type: 'array',
        items: { type: 'string' }
      },
      risks: {
        type: 'array',
        items: { type: 'string' }
      },
      artifacts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'type', 'content'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: outputTypes },
            content: { type: 'string' }
          }
        }
      }
    }
  };
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string') {
    return response.output_text;
  }

  for (const item of safeArray(response.output)) {
    for (const content of safeArray(item.content)) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return '';
}

async function callOpenAiJson(env, { instructions, input, schemaName, schema, maxOutputTokens = 2400 }) {
  const openai = getOpenAi(env);

  if (!openai) {
    return {
      ok: false,
      reason: 'missing_openai_api_key',
      model: env.OPENAI_MODEL || defaultOpenAiModel
    };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${openai.key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: openai.model,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });
  const rawText = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      reason: 'openai_request_failed',
      status: response.status,
      error: rawText.slice(0, 800),
      model: openai.model
    };
  }

  const raw = JSON.parse(rawText);
  const outputText = extractOutputText(raw);

  try {
    return {
      ok: true,
      data: JSON.parse(outputText),
      raw,
      model: openai.model
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'openai_json_parse_failed',
      error: error.message,
      outputText: outputText.slice(0, 800),
      model: openai.model
    };
  }
}

async function callOpenAiText(env, { instructions, input, maxOutputTokens = 1200 }) {
  const openai = getOpenAi(env);

  if (!openai) {
    return {
      ok: false,
      reason: 'missing_openai_api_key',
      model: env.OPENAI_MODEL || defaultOpenAiModel
    };
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${openai.key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: openai.model,
      instructions,
      input,
      max_output_tokens: maxOutputTokens
    })
  });
  const rawText = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      reason: 'openai_request_failed',
      status: response.status,
      error: rawText.slice(0, 800),
      model: openai.model
    };
  }

  const raw = JSON.parse(rawText);
  return {
    ok: true,
    text: extractOutputText(raw),
    raw,
    model: openai.model
  };
}

function normalizePlan(candidate, payload, agents) {
  const fallback = fallbackPlan(payload, agents);
  const plan = candidate && typeof candidate === 'object' ? candidate : fallback;
  const agentNames = new Set(agents.map((agent) => agent.name));
  const delegatedTo = safeArray(plan.delegatedTo)
    .map((assignment) => {
      const fallbackAgent = findAgent(agents, assignment.agent) || agents[0] || fallbackAgents[0];
      const name = agentNames.has(assignment.agent) ? assignment.agent : fallbackAgent.name;

      return {
        agent: normalizeText(name, fallbackAgent.name),
        role: normalizeText(assignment.role, fallbackAgent.domain),
        why: normalizeText(assignment.why, 'Participa por el alcance de la iniciativa.'),
        status: normalizeEnum(assignment.status, taskStatuses, 'queued'),
        nextAction: normalizeText(assignment.nextAction, 'Preparar siguiente accion.')
      };
    })
    .filter((assignment) => assignment.agent)
    .slice(0, 6);

  return {
    summary: normalizeText(plan.summary, fallback.summary),
    stage: normalizeEnum(plan.stage, stages, fallback.stage),
    riskLevel: normalizeEnum(plan.riskLevel, riskLevels, fallback.riskLevel),
    delegatedTo: delegatedTo.length ? delegatedTo : fallback.delegatedTo,
    plan: safeArray(plan.plan)
      .map((step) => ({
        title: normalizeText(step.title, 'Paso operativo'),
        owner: normalizeText(step.owner, 'Product Strategist'),
        detail: normalizeText(step.detail, 'Definir accion y evidencia esperada.'),
        status: normalizeEnum(step.status, taskStatuses, 'queued')
      }))
      .slice(0, 8),
    acceptanceCriteria: safeArray(plan.acceptanceCriteria)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 8),
    blockers: safeArray(plan.blockers)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 8),
    outputs: safeArray(plan.outputs)
      .map((output) => ({
        name: normalizeText(output.name, 'Entregable'),
        outputType: normalizeEnum(output.outputType, outputTypes, 'doc'),
        definition: normalizeText(output.definition, 'Definir contenido y criterio de aceptacion.'),
        status: normalizeEnum(output.status, taskStatuses, 'queued')
      }))
      .slice(0, 8)
  };
}

async function buildMissionPlan(env, payload, agents) {
  const model = env.OPENAI_MODEL || defaultOpenAiModel;
  const fallback = fallbackPlan(payload, agents);
  const input = JSON.stringify(
    {
      mission: {
        title: normalizeText(payload.title, 'Nueva iniciativa'),
        objective: normalizeText(payload.objective),
        scope: normalizeText(payload.scope || payload.scopeText || payload.initiative),
        constraints: normalizeText(payload.constraints),
        stage: normalizeEnum(payload.stage, stages, 'plan'),
        riskLevel: normalizeEnum(payload.riskLevel || payload.risk_level, riskLevels, 'medium')
      },
      availableAgents: agents
    },
    null,
    2
  );
  const result = await callOpenAiJson(env, {
    schemaName: 'mission_control_plan',
    schema: missionPlanSchema(),
    instructions:
      'Eres la capa de IA de Mission Control. Convierte una iniciativa en un plan operativo multi-agente. Responde en espanol neutro, concreto, accionable y sin texto fuera del JSON.',
    input,
    maxOutputTokens: 2600
  });

  if (!result.ok) {
    return {
      ...fallback,
      source: 'fallback',
      aiStatus: 'fallback',
      aiModel: result.model || model,
      aiError: result.reason || result.error
    };
  }

  return {
    ...normalizePlan(result.data, payload, agents),
    source: 'openai',
    aiStatus: 'ready',
    aiModel: result.model,
    aiError: undefined
  };
}

function missionScopeText(payload) {
  return [
    normalizeText(payload.objective) ? `Objetivo: ${normalizeText(payload.objective)}` : '',
    normalizeText(payload.scope || payload.scopeText || payload.initiative),
    normalizeText(payload.constraints) ? `Restricciones: ${normalizeText(payload.constraints)}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

function projectScopeText(payload) {
  return normalizeText(
    payload.scope || payload.scopeDefinition || payload.scope_definition || payload.description,
    normalizeText(payload.objective, normalizeText(payload.name, 'Proyecto operativo'))
  );
}

function normalizeGithubRepo(value) {
  const repo = normalizeText(value);
  return repo.startsWith('https://github.com/') ? repo : defaultProjectRepo;
}

function slugify(value, fallback = 'project') {
  const slug = normalizeText(value, fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54);

  return slug || fallback;
}

function normalizeFramework(value) {
  return normalizeEnum(value, frameworks, 'cloudflare-worker-supabase');
}

function normalizeGithubOrg(env, value) {
  return normalizeText(value || env.GITHUB_ORG, defaultGithubOrg);
}

function plannedSubdomain(repoName, env, value) {
  const zone = normalizeText(env.CLOUDFLARE_ZONE_NAME, defaultCloudflareZone);
  const host = normalizeText(value);

  if (host.includes('.')) {
    return host.toLowerCase();
  }

  return `${slugify(host || repoName)}.${zone}`;
}

function integrationState(configured, extra = {}) {
  return {
    configured,
    status: configured ? 'ready' : 'pending_config',
    ...extra
  };
}

function projectPromptBlueprint(payload, plan) {
  return [
    `Proyecto: ${normalizeText(payload.name, 'Proyecto')}`,
    `Objetivo: ${normalizeText(payload.objective, 'Definir objetivo')}`,
    `Scope: ${projectScopeText(payload)}`,
    `Framework: ${normalizeFramework(payload.framework)}`,
    `Restricciones: ${normalizeText(payload.constraints, 'Sin restricciones declaradas')}`,
    `Resumen IA: ${normalizeText(plan?.summary, 'Plan inicial pendiente')}`
  ].join('\n');
}

function mapProjectRow(row) {
  return {
    id: row.id,
    name: row.name,
    objective: row.objective,
    scopeDefinition: row.scope_definition,
    audience: row.audience || '',
    constraints: row.constraints || '',
    riskLevel: row.risk_level,
    status: row.status || 'active',
    projectType: row.project_type || 'general',
    framework: row.framework || 'cloudflare-worker-supabase',
    repoName: row.repo_name || '',
    githubOrg: row.github_org || defaultGithubOrg,
    subdomain: row.subdomain || '',
    supabaseProjectRef: row.supabase_project_ref || null,
    supabaseProjectUrl: row.supabase_project_url || null,
    cloudflareZone: row.cloudflare_zone || defaultCloudflareZone,
    provisioningStatus: row.provisioning_status || {},
    learningSummary: row.learning_summary || '',
    cycleCount: row.cycle_count || 0,
    lastCycleAt: row.last_cycle_at || null,
    githubRepo: row.github_repo || defaultProjectRepo,
    promptBlueprint: row.prompt_blueprint || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function mapMissionRow(row) {
  return {
    id: row.id,
    projectId: row.project_id || null,
    title: row.title,
    objective: row.objective || '',
    scopeText: row.scope_text,
    stage: row.stage,
    riskLevel: row.risk_level,
    summary: row.summary || '',
    learningSummary: row.learning_summary || '',
    cycleCount: row.cycle_count || 0,
    lastCycleAt: row.last_cycle_at || null,
    aiStatus: row.ai_status || '',
    aiModel: row.ai_model || '',
    aiResponse: row.ai_response || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function mapRunRow(row) {
  return {
    id: row.id,
    missionId: row.initiative_id,
    cycleNumber: row.cycle_number || undefined,
    provider: row.provider,
    model: row.model,
    status: row.status,
    prompt: row.prompt,
    instruction: row.instruction || row.prompt,
    response: row.response || {},
    errorText: row.error_text || '',
    memorySnapshot: row.memory_snapshot || {},
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined
  };
}

function mapAssignmentRow(row) {
  return {
    id: row.id,
    agent: row.agent_key,
    role: row.agent_role || '',
    why: row.assignment_reason || '',
    nextAction: row.next_action || '',
    status: row.status,
    createdAt: row.created_at
  };
}

function mapStepRow(row) {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    owner: row.owner_agent_key,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function mapOutputRow(row) {
  return {
    id: row.id,
    name: row.name,
    outputType: row.output_type,
    definition: row.definition,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function mapProjectTaskRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    missionId: row.initiative_id || null,
    title: row.title,
    detail: row.detail || '',
    owner: row.owner_agent_key || 'Product Strategist',
    priority: row.priority || 'medium',
    status: row.status,
    sourceCycleNumber: row.source_cycle_number || null,
    dueOn: row.due_on || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function mapProjectArtifactRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    missionId: row.initiative_id || null,
    aiRunId: row.ai_run_id || null,
    name: row.name,
    artifactType: row.artifact_type,
    content: row.content,
    sourceCycleNumber: row.source_cycle_number || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

function projectStandard(env, payload) {
  const repoName = slugify(payload.repoName || payload.repo_name || payload.name || payload.title);
  const githubOrg = normalizeGithubOrg(env, payload.githubOrg || payload.github_org);
  const subdomain = plannedSubdomain(repoName, env, payload.subdomain);
  const framework = normalizeFramework(payload.framework);
  const cloudflareZone = normalizeText(env.CLOUDFLARE_ZONE_NAME, defaultCloudflareZone);

  return {
    framework,
    repoName,
    githubOrg,
    githubRepo: `https://github.com/${githubOrg}/${repoName}`,
    subdomain,
    cloudflareZone
  };
}

async function createGithubRepo(env, standard, payload) {
  if (!env.GITHUB_TOKEN) {
    return integrationState(false, {
      provider: 'github',
      target: `${standard.githubOrg}/${standard.repoName}`,
      reason: 'missing_github_token'
    });
  }

  const privateRepo = String(env.GITHUB_REPO_PRIVATE || 'true').toLowerCase() !== 'false';
  const description = normalizeText(
    payload.description || payload.objective,
    `Provisioned by Mission Control for ${standard.subdomain}`
  );
  const createResponse = await fetch(`https://api.github.com/orgs/${standard.githubOrg}/repos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'mission-control-worker',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      name: standard.repoName,
      description,
      homepage: `https://${standard.subdomain}`,
      private: privateRepo,
      auto_init: true,
      has_issues: true,
      has_projects: true,
      has_wiki: false
    })
  });
  const body = await createResponse.text();

  if (createResponse.ok) {
    const repo = JSON.parse(body);
    return {
      configured: true,
      provider: 'github',
      status: 'created',
      target: repo.full_name,
      url: repo.html_url
    };
  }

  if (createResponse.status === 422) {
    const existing = await fetch(`https://api.github.com/repos/${standard.githubOrg}/${standard.repoName}`, {
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'mission-control-worker'
      }
    });

    if (existing.ok) {
      const repo = await existing.json();
      return {
        configured: true,
        provider: 'github',
        status: 'exists',
        target: repo.full_name,
        url: repo.html_url
      };
    }
  }

  return {
    configured: true,
    provider: 'github',
    status: 'error',
    target: `${standard.githubOrg}/${standard.repoName}`,
    error: body.slice(0, 800)
  };
}

async function createSupabaseProject(env, standard, payload) {
  const missing = [];
  if (!env.SUPABASE_ACCESS_TOKEN) missing.push('SUPABASE_ACCESS_TOKEN');
  if (!env.SUPABASE_ORG_ID) missing.push('SUPABASE_ORG_ID');
  if (!env.SUPABASE_DB_PASSWORD) missing.push('SUPABASE_DB_PASSWORD');

  if (missing.length) {
    return integrationState(false, {
      provider: 'supabase',
      target: standard.repoName,
      reason: `missing_${missing.join('_').toLowerCase()}`
    });
  }

  const response = await fetch('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      organization_id: env.SUPABASE_ORG_ID,
      name: standard.repoName,
      database_password: env.SUPABASE_DB_PASSWORD,
      region: env.SUPABASE_REGION || 'us-east-1'
    })
  });
  const body = await response.text();

  if (!response.ok) {
    return {
      configured: true,
      provider: 'supabase',
      status: 'error',
      target: standard.repoName,
      error: body.slice(0, 800)
    };
  }

  const project = JSON.parse(body);
  return {
    configured: true,
    provider: 'supabase',
    status: 'created',
    target: project.name || standard.repoName,
    projectRef: project.id || project.ref || null,
    url: project.id ? `https://${project.id}.supabase.co` : null,
    raw: project
  };
}

async function createCloudflareSubdomain(env, standard) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    return integrationState(false, {
      provider: 'cloudflare',
      target: standard.subdomain,
      reason: 'missing_cloudflare_api_token_or_zone_id'
    });
  }

  const target = normalizeText(env.CLOUDFLARE_DEFAULT_CNAME_TARGET);
  const workerName = normalizeText(env.CLOUDFLARE_DEFAULT_WORKER_NAME);

  if (!target && !workerName) {
    return integrationState(false, {
      configured: true,
      provider: 'cloudflare',
      target: standard.subdomain,
      reason: 'missing_cloudflare_default_cname_target_or_worker_name'
    });
  }

  if (target) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: standard.subdomain,
        content: target,
        proxied: true,
        ttl: 1,
        comment: 'Provisioned by Mission Control'
      })
    });
    const body = await response.text();

    if (response.ok) {
      return {
        configured: true,
        provider: 'cloudflare',
        status: 'created',
        target: standard.subdomain,
        mode: 'dns_cname'
      };
    }

    if (response.status === 409 || body.includes('already exists')) {
      return {
        configured: true,
        provider: 'cloudflare',
        status: 'exists',
        target: standard.subdomain,
        mode: 'dns_cname'
      };
    }

    return {
      configured: true,
      provider: 'cloudflare',
      status: 'error',
      target: standard.subdomain,
      error: body.slice(0, 800)
    };
  }

  return {
    configured: true,
    provider: 'cloudflare',
    status: 'pending_worker_binding',
    target: standard.subdomain,
    workerName
  };
}

async function provisionProject(env, standard, payload) {
  const [github, supabase, cloudflare] = await Promise.all([
    createGithubRepo(env, standard, payload),
    createSupabaseProject(env, standard, payload),
    createCloudflareSubdomain(env, standard)
  ]);

  return {
    standard: {
      framework: standard.framework,
      githubOrg: standard.githubOrg,
      repoName: standard.repoName,
      githubRepo: standard.githubRepo,
      subdomain: standard.subdomain,
      cloudflareZone: standard.cloudflareZone
    },
    github,
    supabase,
    cloudflare,
    updatedAt: new Date().toISOString()
  };
}

function projectTaskRowsFromSteps(projectId, missionId, steps, cycleNumber) {
  if (!projectId) return [];

  return safeArray(steps)
    .map((step) => ({
      project_id: projectId,
      initiative_id: missionId || null,
      title: normalizeText(step.title || step.stepTitle, 'Tarea operativa'),
      detail: normalizeText(step.detail || step.note, 'Definir detalle de ejecucion.'),
      owner_agent_key: normalizeText(step.owner || step.ownerAgentKey, 'Product Strategist'),
      priority: normalizeEnum(step.priority, taskPriorities, 'medium'),
      status: normalizeEnum(step.status, taskStatuses, 'queued'),
      source_cycle_number: cycleNumber || null
    }))
    .filter((task) => task.title);
}

function projectArtifactRowsFromOutputs(projectId, missionId, outputs, cycleNumber, aiRunId) {
  if (!projectId) return [];

  return safeArray(outputs)
    .map((output) => ({
      project_id: projectId,
      initiative_id: missionId || null,
      ai_run_id: aiRunId || null,
      name: normalizeText(output.name, 'Artifact'),
      artifact_type: normalizeEnum(output.outputType || output.type || output.artifactType, outputTypes, 'doc'),
      content: normalizeText(output.content || output.definition, 'Artifact pendiente de completar.'),
      source_cycle_number: cycleNumber || null
    }))
    .filter((artifact) => artifact.name && artifact.content);
}

async function insertProjectTasks(env, rows) {
  if (!rows.length || !getSupabase(env)) return [];
  const data = await supabaseFetch(env, '/rest/v1/project_tasks?select=*', {
    method: 'POST',
    body: JSON.stringify(rows)
  });
  return safeArray(data).map(mapProjectTaskRow);
}

async function insertProjectArtifacts(env, rows) {
  if (!rows.length || !getSupabase(env)) return [];
  const data = await supabaseFetch(env, '/rest/v1/project_artifacts?select=*', {
    method: 'POST',
    body: JSON.stringify(rows)
  });
  return safeArray(data).map(mapProjectArtifactRow);
}

function buildFallbackMission(payload, plan) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const mission = {
    id,
    title: normalizeText(payload.title, 'Nueva iniciativa'),
    objective: normalizeText(payload.objective),
    scopeText: missionScopeText(payload),
    stage: plan.stage,
    riskLevel: plan.riskLevel,
    summary: plan.summary,
    learningSummary: '',
    cycleCount: 0,
    lastCycleAt: undefined,
    aiStatus: plan.aiStatus,
    aiModel: plan.aiModel || defaultOpenAiModel,
    aiResponse: plan,
    createdAt: now,
    updatedAt: now,
    assignments: plan.delegatedTo.map((assignment) => ({
      id: crypto.randomUUID(),
      ...assignment,
      createdAt: now
    })),
    steps: plan.plan.map((step, index) => ({
      id: crypto.randomUUID(),
      position: index + 1,
      ...step,
      createdAt: now,
      updatedAt: now
    })),
    outputs: plan.outputs.map((output) => ({
      id: crypto.randomUUID(),
      ...output,
      createdAt: now,
      updatedAt: now
    })),
    runs: []
  };

  fallbackMissions.unshift(mission);
  return mission;
}

async function listProjects(env) {
  if (!getSupabase(env)) {
    return fallbackProjects;
  }

  const rows = await safeSupabaseFetch(
    env,
    '/rest/v1/projects?select=id,name,objective,scope_definition,audience,constraints,risk_level,status,project_type,framework,repo_name,github_org,subdomain,supabase_project_ref,supabase_project_url,cloudflare_zone,provisioning_status,learning_summary,cycle_count,last_cycle_at,github_repo,prompt_blueprint,created_at,updated_at&order=created_at.desc&limit=50'
  );

  return safeArray(rows).map(mapProjectRow);
}

async function getProjectDetails(env, id) {
  if (!getSupabase(env)) {
    return fallbackProjects.find((project) => project.id === id);
  }

  const [projectRows, missionRows, taskRows, artifactRows] = await Promise.all([
    supabaseFetch(env, `/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=*`),
    supabaseFetch(
      env,
      `/rest/v1/initiatives?project_id=eq.${encodeURIComponent(id)}&select=id,project_id,title,objective,scope_text,stage,risk_level,summary,learning_summary,cycle_count,last_cycle_at,ai_status,ai_model,ai_response,created_at,updated_at&order=created_at.desc&limit=25`
    ),
    supabaseFetch(
      env,
      `/rest/v1/project_tasks?project_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=100`
    ),
    supabaseFetch(
      env,
      `/rest/v1/project_artifacts?project_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=100`
    )
  ]);

  if (!projectRows?.[0]) {
    return undefined;
  }

  return {
    ...mapProjectRow(projectRows[0]),
    missions: safeArray(missionRows).map(mapMissionRow),
    tasks: safeArray(taskRows).map(mapProjectTaskRow),
    artifacts: safeArray(artifactRows).map(mapProjectArtifactRow)
  };
}

async function createProject(env, payload) {
  const name = normalizeText(payload.name || payload.title);
  const objective = normalizeText(payload.objective);
  const scopeDefinition = projectScopeText(payload);
  const framework = normalizeText(payload.framework);

  if (!name || !objective || !scopeDefinition || !framework) {
    return json({ error: 'name, objective, scope and framework are required' }, { status: 400 });
  }

  const standard = projectStandard(env, { ...payload, name, objective, framework });
  const agents = await listAgents(env);
  const plan = await buildMissionPlan(
    env,
    {
      title: name,
      objective,
      scope: scopeDefinition,
      constraints: normalizeText(payload.constraints),
      framework: standard.framework,
      stage: 'plan',
      riskLevel: normalizeEnum(payload.riskLevel || payload.risk_level, riskLevels, 'medium')
    },
    agents
  );
  const now = new Date().toISOString();

  if (!getSupabase(env)) {
    const project = {
      id: crypto.randomUUID(),
      name,
      objective,
      scopeDefinition,
      audience: normalizeText(payload.audience, 'Equipo operativo'),
      constraints: normalizeText(payload.constraints),
      riskLevel: plan.riskLevel,
      status: 'active',
      projectType: normalizeText(payload.projectType || payload.project_type, 'general'),
      framework: standard.framework,
      repoName: standard.repoName,
      githubOrg: standard.githubOrg,
      subdomain: standard.subdomain,
      cloudflareZone: standard.cloudflareZone,
      provisioningStatus: await provisionProject(env, standard, payload),
      learningSummary: '',
      cycleCount: 0,
      lastCycleAt: null,
      githubRepo: standard.githubRepo,
      promptBlueprint: projectPromptBlueprint({ ...payload, name, objective, framework: standard.framework }, plan),
      createdAt: now,
      updatedAt: now,
      missions: [],
      tasks: projectTaskRowsFromSteps('fallback', null, plan.plan).map((task) => ({
        ...task,
        id: crypto.randomUUID(),
        projectId: 'fallback'
      })),
      artifacts: projectArtifactRowsFromOutputs('fallback', null, plan.outputs).map((artifact) => ({
        ...artifact,
        id: crypto.randomUUID(),
        projectId: 'fallback'
      }))
    };
    fallbackProjects.unshift(project);
    return json(project, { status: 201 });
  }

  const projectRows = await supabaseFetch(env, '/rest/v1/projects?select=*', {
    method: 'POST',
    body: JSON.stringify({
      name,
      objective,
      scope_definition: scopeDefinition,
      audience: normalizeText(payload.audience, 'Equipo operativo'),
      constraints: normalizeText(payload.constraints),
      risk_level: plan.riskLevel,
      discovery_mode: true,
      github_repo: standard.githubRepo,
      prompt_blueprint: projectPromptBlueprint({ ...payload, name, objective, framework: standard.framework }, plan),
      status: 'active',
      project_type: normalizeText(payload.projectType || payload.project_type, 'general'),
      framework: standard.framework,
      repo_name: standard.repoName,
      github_org: standard.githubOrg,
      subdomain: standard.subdomain,
      cloudflare_zone: standard.cloudflareZone,
      provisioning_status: {
        standard: {
          framework: standard.framework,
          githubOrg: standard.githubOrg,
          repoName: standard.repoName,
          githubRepo: standard.githubRepo,
          subdomain: standard.subdomain,
          cloudflareZone: standard.cloudflareZone
        },
        github: { status: 'queued' },
        supabase: { status: 'queued' },
        cloudflare: { status: 'queued' },
        updatedAt: now
      }
    })
  });
  const project = projectRows[0];
  const missionResponse = await createMission(env, {
    projectId: project.id,
    title: `Plan inicial: ${name}`,
    objective,
    scope: scopeDefinition,
    constraints: normalizeText(payload.constraints),
    stage: 'plan',
    riskLevel: plan.riskLevel,
    existingPlan: plan
  });

  if (!missionResponse.ok) {
    throw new Error(await missionResponse.text());
  }

  const provisioning = await provisionProject(env, standard, payload);
  await supabaseFetch(env, `/rest/v1/projects?id=eq.${encodeURIComponent(project.id)}&select=*`, {
    method: 'PATCH',
    body: JSON.stringify({
      provisioning_status: provisioning,
      supabase_project_ref: provisioning.supabase.projectRef || null,
      supabase_project_url: provisioning.supabase.url || null,
      github_repo: provisioning.github.url || standard.githubRepo,
      updated_at: provisioning.updatedAt
    })
  });

  return json(await getProjectDetails(env, project.id), { status: 201 });
}

async function listProjectTasks(env, projectId) {
  const project = await getProjectDetails(env, projectId);
  return project ? project.tasks : undefined;
}

async function provisionExistingProject(env, projectId) {
  const project = await getProjectDetails(env, projectId);

  if (!project) {
    return json({ error: 'project not found' }, { status: 404 });
  }

  const standard = projectStandard(env, {
    name: project.name,
    repoName: project.repoName || project.name,
    githubOrg: project.githubOrg,
    subdomain: project.subdomain,
    framework: project.framework
  });
  const provisioning = await provisionProject(env, standard, project);

  if (getSupabase(env)) {
    await supabaseFetch(env, `/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=*`, {
      method: 'PATCH',
      body: JSON.stringify({
        framework: standard.framework,
        repo_name: standard.repoName,
        github_org: standard.githubOrg,
        github_repo: provisioning.github.url || standard.githubRepo,
        subdomain: standard.subdomain,
        cloudflare_zone: standard.cloudflareZone,
        supabase_project_ref: provisioning.supabase.projectRef || project.supabaseProjectRef || null,
        supabase_project_url: provisioning.supabase.url || project.supabaseProjectUrl || null,
        provisioning_status: provisioning,
        updated_at: provisioning.updatedAt
      })
    });
  }

  return json({
    projectId,
    provisioning
  });
}

async function createProjectTask(env, projectId, payload) {
  if (!normalizeText(payload.title)) {
    return json({ error: 'title is required' }, { status: 400 });
  }

  if (!getSupabase(env)) {
    return json({ error: 'Supabase is required for project tasks' }, { status: 503 });
  }

  const rows = await insertProjectTasks(env, [
    {
      project_id: projectId,
      initiative_id: normalizeText(payload.missionId || payload.initiativeId) || null,
      title: normalizeText(payload.title),
      detail: normalizeText(payload.detail),
      owner_agent_key: normalizeText(payload.owner || payload.ownerAgentKey, 'Product Strategist'),
      priority: normalizeEnum(payload.priority, taskPriorities, 'medium'),
      status: normalizeEnum(payload.status, taskStatuses, 'queued')
    }
  ]);

  return rows[0] ? json(rows[0], { status: 201 }) : json({ error: 'task not created' }, { status: 500 });
}

async function listProjectArtifacts(env, projectId) {
  const project = await getProjectDetails(env, projectId);
  return project ? project.artifacts : undefined;
}

async function createProjectArtifact(env, projectId, payload) {
  if (!normalizeText(payload.name) || !normalizeText(payload.content)) {
    return json({ error: 'name and content are required' }, { status: 400 });
  }

  if (!getSupabase(env)) {
    return json({ error: 'Supabase is required for project artifacts' }, { status: 503 });
  }

  const rows = await insertProjectArtifacts(env, [
    {
      project_id: projectId,
      initiative_id: normalizeText(payload.missionId || payload.initiativeId) || null,
      name: normalizeText(payload.name),
      artifact_type: normalizeEnum(payload.artifactType || payload.type, outputTypes, 'doc'),
      content: normalizeText(payload.content)
    }
  ]);

  return rows[0] ? json(rows[0], { status: 201 }) : json({ error: 'artifact not created' }, { status: 500 });
}

async function updateProjectTask(env, taskId, payload) {
  const updates = {
    updated_at: new Date().toISOString()
  };

  if (payload.status) updates.status = normalizeEnum(payload.status, taskStatuses, 'queued');
  if (payload.priority) updates.priority = normalizeEnum(payload.priority, taskPriorities, 'medium');
  if (payload.title) updates.title = normalizeText(payload.title);
  if (payload.detail !== undefined) updates.detail = normalizeText(payload.detail);
  if (payload.owner || payload.ownerAgentKey) {
    updates.owner_agent_key = normalizeText(payload.owner || payload.ownerAgentKey, 'Product Strategist');
  }

  const rows = await supabaseFetch(env, `/rest/v1/project_tasks?id=eq.${encodeURIComponent(taskId)}&select=*`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });

  return rows?.[0] ? json(mapProjectTaskRow(rows[0])) : json({ error: 'task not found' }, { status: 404 });
}

async function storeAiRun(env, payload) {
  if (!getSupabase(env)) {
    return undefined;
  }

  return supabaseFetch(env, '/rest/v1/ai_runs?select=*', {
    method: 'POST',
    body: JSON.stringify({
      initiative_id: payload.initiativeId,
      cycle_number: payload.cycleNumber || null,
      provider: 'openai',
      model: payload.model,
      status: payload.status,
      prompt: payload.prompt,
      instruction: payload.instruction || payload.prompt,
      response: payload.response,
      memory_snapshot: payload.memorySnapshot || {},
      error_text: payload.errorText || null,
      completed_at: new Date().toISOString()
    })
  });
}

async function createMission(env, payload) {
  const title = normalizeText(payload.title);
  const scopeText = missionScopeText(payload);
  const projectId = normalizeText(payload.projectId || payload.project_id) || null;

  if (!title || !scopeText) {
    return json({ error: 'title and scope are required' }, { status: 400 });
  }

  const agents = await listAgents(env);
  const plan = payload.existingPlan || (await buildMissionPlan(env, payload, agents));

  if (!getSupabase(env)) {
    const mission = buildFallbackMission(payload, plan);
    mission.projectId = projectId;
    return json(mission, { status: 201 });
  }

  const initiativeRows = await supabaseFetch(env, '/rest/v1/initiatives?select=*', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      title,
      objective: normalizeText(payload.objective),
      scope_text: scopeText,
      stage: plan.stage,
      risk_level: plan.riskLevel,
      summary: plan.summary,
      ai_status: plan.aiStatus,
      ai_model: plan.aiModel,
      ai_response: plan
    })
  });
  const initiative = initiativeRows[0];
  const initiativeId = initiative.id;
  const assignments = plan.delegatedTo.map((assignment) => ({
    initiative_id: initiativeId,
    agent_key: assignment.agent,
    agent_role: assignment.role,
    assignment_reason: assignment.why,
    next_action: assignment.nextAction,
    status: assignment.status
  }));
  const steps = plan.plan.map((step, index) => ({
    initiative_id: initiativeId,
    position: index + 1,
    title: step.title,
    owner_agent_key: step.owner,
    detail: step.detail,
    status: step.status
  }));
  const outputs = plan.outputs.map((output) => ({
    initiative_id: initiativeId,
    name: output.name,
    output_type: output.outputType,
    definition: output.definition,
    status: output.status
  }));

  await Promise.all([
    assignments.length
      ? supabaseFetch(env, '/rest/v1/initiative_assignments?select=*', {
          method: 'POST',
          body: JSON.stringify(assignments)
        })
      : undefined,
    steps.length
      ? supabaseFetch(env, '/rest/v1/initiative_steps?select=*', {
          method: 'POST',
          body: JSON.stringify(steps)
        })
      : undefined,
    outputs.length
      ? supabaseFetch(env, '/rest/v1/initiative_outputs?select=*', {
          method: 'POST',
          body: JSON.stringify(outputs)
        })
      : undefined,
    storeAiRun(env, {
      initiativeId,
      model: plan.aiModel,
      status: plan.source === 'openai' ? 'completed' : 'fallback',
      prompt: title,
      instruction: 'create mission plan',
      response: plan,
      memorySnapshot: {
        learningSummary: '',
        cycleCount: 0,
        source: 'mission_create'
      },
      errorText: plan.aiError
    })
  ]);

  if (projectId) {
    await Promise.all([
      insertProjectTasks(env, projectTaskRowsFromSteps(projectId, initiativeId, plan.plan)),
      insertProjectArtifacts(env, projectArtifactRowsFromOutputs(projectId, initiativeId, plan.outputs))
    ]);
  }

  return json(await getMissionDetails(env, initiativeId), { status: 201 });
}

async function listMissions(env, projectId) {
  if (!getSupabase(env)) {
    return projectId ? fallbackMissions.filter((mission) => mission.projectId === projectId) : fallbackMissions;
  }

  const projectFilter = projectId ? `project_id=eq.${encodeURIComponent(projectId)}&` : '';
  const data = await safeSupabaseFetch(
    env,
    `/rest/v1/initiatives?${projectFilter}select=id,project_id,title,objective,scope_text,stage,risk_level,summary,learning_summary,cycle_count,last_cycle_at,ai_status,ai_model,ai_response,created_at,updated_at&order=created_at.desc&limit=50`
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(mapMissionRow);
}

async function getMissionDetails(env, id) {
  if (!getSupabase(env)) {
    return fallbackMissions.find((mission) => mission.id === id);
  }

  const [missionRows, assignmentRows, stepRows, outputRows, runRows] = await Promise.all([
    supabaseFetch(env, `/rest/v1/initiatives?id=eq.${encodeURIComponent(id)}&select=*`),
    supabaseFetch(
      env,
      `/rest/v1/initiative_assignments?initiative_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`
    ),
    supabaseFetch(
      env,
      `/rest/v1/initiative_steps?initiative_id=eq.${encodeURIComponent(id)}&select=*&order=position.asc`
    ),
    supabaseFetch(
      env,
      `/rest/v1/initiative_outputs?initiative_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`
    ),
    supabaseFetch(
      env,
      `/rest/v1/ai_runs?initiative_id=eq.${encodeURIComponent(id)}&select=*&order=started_at.desc&limit=25`
    )
  ]);

  if (!missionRows?.[0]) {
    return undefined;
  }

  return {
    ...mapMissionRow(missionRows[0]),
    assignments: safeArray(assignmentRows).map(mapAssignmentRow),
    steps: safeArray(stepRows).map(mapStepRow),
    outputs: safeArray(outputRows).map(mapOutputRow),
    runs: safeArray(runRows).map(mapRunRow)
  };
}

async function listMissionRuns(env, id) {
  if (!getSupabase(env)) {
    const mission = fallbackMissions.find((item) => item.id === id);
    return mission ? safeArray(mission.runs) : undefined;
  }

  const rows = await supabaseFetch(
    env,
    `/rest/v1/ai_runs?initiative_id=eq.${encodeURIComponent(id)}&select=*&order=started_at.desc&limit=50`
  );

  return safeArray(rows)
    .map(mapRunRow)
    .filter((run) => run.cycleNumber || run.response?.cycleNumber);
}

function compactRunForMemory(run) {
  const response = run.response || run;

  return {
    cycleNumber: run.cycleNumber || response.cycleNumber,
    status: response.status || run.status,
    instruction: run.instruction || response.instruction || run.prompt,
    brief: response.brief || '',
    learningSummary: response.learningSummary || '',
    decisions: safeArray(response.decisions).slice(0, 6),
    newFacts: safeArray(response.newFacts).slice(0, 6),
    nextActions: safeArray(response.nextActions).slice(0, 6),
    risks: safeArray(response.risks).slice(0, 6),
    completedAt: run.completedAt || run.startedAt
  };
}

function buildMissionMemory(mission) {
  const recentCycles = safeArray(mission.runs)
    .filter((run) => run.cycleNumber || run.response?.cycleNumber)
    .slice(0, 12)
    .map(compactRunForMemory);

  return {
    learningSummary:
      mission.learningSummary ||
      mission.aiResponse?.memory?.learningSummary ||
      mission.aiResponse?.lastRun?.learningSummary ||
      '',
    cycleCount: mission.cycleCount || recentCycles.length || 0,
    lastCycleAt: mission.lastCycleAt || recentCycles[0]?.completedAt,
    recentCycles
  };
}

function normalizeRun(candidate, cycleNumber, instruction, memory) {
  return {
    ...candidate,
    cycleNumber,
    instruction,
    brief: normalizeText(candidate.brief, 'Ciclo ejecutado.'),
    status: normalizeEnum(candidate.status, ['running', 'blocked', 'done'], 'running'),
    learningSummary: normalizeText(candidate.learningSummary, memory.learningSummary || candidate.brief),
    decisions: safeArray(candidate.decisions)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    newFacts: safeArray(candidate.newFacts)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    completedSteps: safeArray(candidate.completedSteps)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    updatedSteps: safeArray(candidate.updatedSteps)
      .map((step) => ({
        stepTitle: normalizeText(step.stepTitle, 'Paso sin titulo'),
        status: normalizeEnum(step.status, taskStatuses, 'running'),
        note: normalizeText(step.note, 'Actualizado por ciclo IA.')
      }))
      .slice(0, 12),
    nextActions: safeArray(candidate.nextActions)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    risks: safeArray(candidate.risks)
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 12),
    artifacts: safeArray(candidate.artifacts)
      .map((artifact) => ({
        name: normalizeText(artifact.name, 'Artifact'),
        type: normalizeEnum(artifact.type, outputTypes, 'doc'),
        content: normalizeText(artifact.content)
      }))
      .filter((artifact) => artifact.content)
      .slice(0, 8)
  };
}

async function runMission(env, missionId, payload) {
  const mission = await getMissionDetails(env, missionId);

  if (!mission) {
    return json({ error: 'mission not found' }, { status: 404 });
  }

  const previousCycleCount =
    mission.cycleCount ||
    safeArray(mission.runs).reduce(
      (max, run) => Math.max(max, run.cycleNumber || run.response?.cycleNumber || 0),
      0
    );
  const cycleNumber = previousCycleCount + 1;
  const instruction = normalizeText(payload.instruction, 'Ejecuta el siguiente avance operativo.');
  const memory = buildMissionMemory(mission);
  const input = JSON.stringify(
    {
      mission: {
        id: mission.id,
        title: mission.title,
        objective: mission.objective,
        scopeText: mission.scopeText,
        stage: mission.stage,
        riskLevel: mission.riskLevel,
        summary: mission.summary,
        assignments: mission.assignments,
        steps: mission.steps,
        outputs: mission.outputs
      },
      cycleNumber,
      instruction,
      projectMemory: memory
    },
    null,
    2
  );
  const result = await callOpenAiJson(env, {
    schemaName: 'mission_control_run',
    schema: missionRunSchema(),
    instructions:
      'Eres Mission Control ejecutando un ciclo de avance. Usa projectMemory y recentCycles como memoria del proyecto. Genera avance operativo, decisiones, hechos nuevos y un learningSummary acumulado que reemplace la memoria anterior. No inventes integraciones externas ya completadas. Responde en espanol neutro y sin texto fuera del JSON.',
    input,
    maxOutputTokens: 2200
  });
  const run = result.ok
    ? normalizeRun(
        {
          ...result.data,
          source: 'openai',
          aiStatus: 'executed',
          aiModel: result.model
        },
        cycleNumber,
        instruction,
        memory
      )
    : normalizeRun(
        {
          brief: 'La mision quedo en cola porque falta configurar OPENAI_API_KEY o la llamada a OpenAI fallo.',
          status: 'blocked',
          learningSummary: memory.learningSummary || 'Sin aprendizaje nuevo; la capa IA no estuvo disponible.',
          decisions: [],
          newFacts: [],
          completedSteps: [],
          updatedSteps: [],
          nextActions: ['Configurar OPENAI_API_KEY como secreto del Worker y reintentar.'],
          risks: [result.reason || result.error || 'openai_unavailable'],
          artifacts: [],
          source: 'fallback',
          aiStatus: 'fallback',
          aiModel: result.model || defaultOpenAiModel
        },
        cycleNumber,
        instruction,
        memory
      );
  const updatedMemory = {
    learningSummary: run.learningSummary,
    cycleCount: cycleNumber,
    lastCycleAt: new Date().toISOString(),
    lastInstruction: instruction
  };

  if (getSupabase(env)) {
    await supabaseFetch(env, `/rest/v1/initiatives?id=eq.${encodeURIComponent(missionId)}&select=*`, {
      method: 'PATCH',
      body: JSON.stringify({
        ai_status: run.aiStatus,
        ai_model: run.aiModel,
        learning_summary: updatedMemory.learningSummary,
        cycle_count: cycleNumber,
        last_cycle_at: updatedMemory.lastCycleAt,
        ai_response: {
          ...(mission.aiResponse || {}),
          lastRun: run,
          memory: updatedMemory
        },
        updated_at: updatedMemory.lastCycleAt
      })
    });
    const aiRunRows = await storeAiRun(env, {
      initiativeId: missionId,
      cycleNumber,
      model: run.aiModel,
      status: result.ok ? 'completed' : 'fallback',
      prompt: instruction,
      instruction,
      response: run,
      memorySnapshot: memory,
      errorText: result.ok ? undefined : result.reason || result.error
    });
    const aiRunId = aiRunRows?.[0]?.id;

    if (mission.projectId) {
      const taskRows = projectTaskRowsFromSteps(
        mission.projectId,
        missionId,
        run.updatedSteps.map((step) => ({
          title: step.stepTitle,
          detail: step.note,
          owner: 'Product Strategist',
          status: step.status
        })).concat(
          run.nextActions.map((action) => ({
            title: action,
            detail: `Siguiente accion generada en ciclo ${cycleNumber}.`,
            owner: 'Product Strategist',
            status: 'queued'
          }))
        ),
        cycleNumber
      );
      const artifactRows = projectArtifactRowsFromOutputs(
        mission.projectId,
        missionId,
        run.artifacts,
        cycleNumber,
        aiRunId
      );

      await Promise.all([
        insertProjectTasks(env, taskRows),
        insertProjectArtifacts(env, artifactRows),
        supabaseFetch(env, `/rest/v1/projects?id=eq.${encodeURIComponent(mission.projectId)}&select=*`, {
          method: 'PATCH',
          body: JSON.stringify({
            learning_summary: updatedMemory.learningSummary,
            cycle_count: cycleNumber,
            last_cycle_at: updatedMemory.lastCycleAt,
            updated_at: updatedMemory.lastCycleAt
          })
        })
      ]);
    }
  } else {
    const fallbackMission = fallbackMissions.find((item) => item.id === missionId);
    if (fallbackMission) {
      fallbackMission.aiStatus = run.aiStatus;
      fallbackMission.learningSummary = updatedMemory.learningSummary;
      fallbackMission.cycleCount = cycleNumber;
      fallbackMission.lastCycleAt = updatedMemory.lastCycleAt;
      fallbackMission.aiResponse = {
        ...(fallbackMission.aiResponse || {}),
        lastRun: run,
        memory: updatedMemory
      };
      fallbackMission.runs.unshift(run);
    }
  }

  return json({ missionId, cycleNumber, run, memory: updatedMemory });
}

async function chatWithMission(env, payload) {
  const message = normalizeText(payload.message);

  if (!message) {
    return json({ error: 'message is required' }, { status: 400 });
  }

  const mission = payload.missionId ? await getMissionDetails(env, payload.missionId) : undefined;
  const result = await callOpenAiText(env, {
    instructions:
      'Eres la capa ChatGPT de Mission Control. Responde como director operativo: breve, accionable, con owners claros y sin prometer acciones externas que no se hayan ejecutado.',
    input: JSON.stringify({ message, mission }, null, 2),
    maxOutputTokens: 1400
  });

  if (!result.ok) {
    return json(
      {
        error: result.reason,
        detail: result.error,
        model: result.model
      },
      { status: 503 }
    );
  }

  return json({
    answer: result.text,
    model: result.model
  });
}

async function delegateInitiative(env, payload) {
  const initiative = normalizeText(payload.initiative || payload.scope || payload.title);

  if (!initiative) {
    return json({ error: 'initiative is required' }, { status: 400 });
  }

  const agents = await listAgents(env);
  const plan = await buildMissionPlan(
    env,
    {
      title: normalizeText(payload.title, 'Delegacion rapida'),
      scope: initiative,
      objective: normalizeText(payload.objective),
      stage: normalizeEnum(payload.stage, stages, 'plan'),
      riskLevel: normalizeEnum(payload.riskLevel, riskLevels, 'medium')
    },
    agents
  );

  return json({
    initiative,
    delegatedTo: plan.delegatedTo.map((assignment) => assignment.agent),
    plan
  });
}

async function updateStep(env, stepId, payload) {
  const status = normalizeEnum(payload.status, taskStatuses, '');

  if (!status) {
    return json({ error: 'valid status is required' }, { status: 400 });
  }

  if (!getSupabase(env)) {
    for (const mission of fallbackMissions) {
      const step = mission.steps.find((item) => item.id === stepId);
      if (step) {
        step.status = status;
        step.updatedAt = new Date().toISOString();
        return json(step);
      }
    }
    return json({ error: 'step not found' }, { status: 404 });
  }

  const data = await supabaseFetch(env, `/rest/v1/initiative_steps?id=eq.${encodeURIComponent(stepId)}&select=*`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString()
    })
  });

  if (!data?.[0]) {
    return json({ error: 'step not found' }, { status: 404 });
  }

  return json(mapStepRow(data[0]));
}

function pageHtml(env) {
  const appUrl = env.PUBLIC_APP_URL || 'https://mission-control.zeqhora.com';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Mission Control</title>
    <style>
      :root{color-scheme:dark;--bg:#08111f;--panel:#0f172a;--panel2:#111c31;--line:#2a3a53;--text:#f8fafc;--muted:#9fb0c7;--accent:#2dd4bf;--accent2:#f59e0b;--danger:#fb7185;--ok:#86efac}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:1440px;margin:0 auto;padding:24px;display:grid;gap:16px}
      header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding-bottom:16px}
      h1,h2,h3,p{margin:0}h1{font-size:clamp(28px,4vw,46px);line-height:1}h2{font-size:16px}h3{font-size:14px;color:var(--muted);font-weight:600}
      small,.muted{color:var(--muted)}button,input,textarea,select{font:inherit}button{border:0;border-radius:6px;padding:10px 12px;background:var(--accent);color:#04221f;font-weight:800;cursor:pointer}button.secondary{background:#1e293b;color:var(--text);border:1px solid var(--line)}button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}button.danger{background:var(--danger);color:#24030a}
      input,textarea,select{width:100%;border:1px solid var(--line);border-radius:6px;padding:10px;background:#07101d;color:var(--text)}textarea{resize:vertical;min-height:94px}
      section,.surface{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}.layout{display:grid;grid-template-columns:360px 1fr 380px;gap:16px}.stack{display:grid;gap:12px}.row{display:flex;gap:10px;align-items:center}.row>*{min-width:0}.split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.badge{display:inline-flex;align-items:center;min-height:24px;border:1px solid var(--line);border-radius:999px;padding:3px 9px;color:var(--muted);font-size:12px}.badge.ok{color:var(--ok);border-color:#1f7a45}.badge.warn{color:var(--accent2);border-color:#8a5b10}.badge.danger{color:var(--danger);border-color:#8a2437}.list{display:grid;gap:8px;max-height:520px;overflow:auto}.item{width:100%;text-align:left;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:12px}.item.active{border-color:var(--accent);box-shadow:0 0 0 1px rgba(45,212,191,.35) inset}.item strong{display:block;margin-bottom:4px}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.empty{border:1px dashed var(--line);border-radius:6px;padding:14px;color:var(--muted)}pre{white-space:pre-wrap;margin:0;color:#dbeafe}.scroll{max-height:360px;overflow:auto}.step{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:start;padding:10px;border:1px solid var(--line);border-radius:6px;background:#0b1424}.num{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#1f2937;color:var(--muted);font-size:12px}.status{font-size:12px;color:var(--muted)}.status.done{color:var(--ok)}.status.blocked{color:var(--danger)}.status.running{color:var(--accent2)}
      @media (max-width:1180px){.layout{grid-template-columns:1fr}.grid3{grid-template-columns:1fr}.grid2{grid-template-columns:1fr}}@media (max-width:760px){main{padding:16px}header{display:grid;align-items:start}.split{grid-template-columns:1fr}.row{display:grid}.toolbar button{flex:1 1 140px}}
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="stack">
          <h1>Mission Control</h1>
          <div class="toolbar">
            <span id="aiStatus" class="badge">AI</span>
            <span id="dbStatus" class="badge">Supabase</span>
            <span class="badge">${appUrl}</span>
          </div>
        </div>
        <div class="row">
          <input id="token" type="password" placeholder="Operator token">
          <button id="saveToken" class="secondary" type="button">Guardar</button>
        </div>
      </header>

      <div class="layout">
        <section class="stack">
          <h2>Nuevo proyecto</h2>
          <form id="projectForm" class="stack">
            <input id="projectName" placeholder="Nombre del proyecto" required>
            <input id="projectObjective" placeholder="Objetivo del proyecto" required>
            <textarea id="projectScope" placeholder="Scope del proyecto" required></textarea>
            <input id="projectAudience" placeholder="Audiencia / equipo">
            <select id="projectFramework" required>
              <option value="cloudflare-worker-supabase">Cloudflare Worker + Supabase</option>
              <option value="nextjs-supabase">Next.js + Supabase</option>
              <option value="react-vite-supabase">React/Vite + Supabase</option>
              <option value="nestjs-supabase">NestJS + Supabase</option>
              <option value="expo-supabase">Expo + Supabase</option>
              <option value="python-fastapi-supabase">FastAPI + Supabase</option>
            </select>
            <div class="split">
              <input id="projectRepoName" placeholder="Repo GitHub (auto)">
              <input id="projectSubdomain" placeholder="Subdominio (auto)">
            </div>
            <textarea id="projectConstraints" placeholder="Restricciones"></textarea>
            <div class="split">
              <select id="projectType">
                <option value="general">General</option>
                <option value="podcast">Podcast</option>
                <option value="software">Software</option>
                <option value="marketing">Marketing</option>
                <option value="legal">Legal</option>
              </select>
              <select id="projectRiskLevel">
                <option value="low">Riesgo bajo</option>
                <option value="medium" selected>Riesgo medio</option>
                <option value="high">Riesgo alto</option>
              </select>
            </div>
            <button type="submit">Crear proyecto</button>
          </form>
          <div class="stack">
            <h2>Proyectos</h2>
            <div id="projects" class="list"></div>
          </div>
          <h2>Nueva mision</h2>
          <form id="missionForm" class="stack">
            <select id="projectSelect">
              <option value="">Sin proyecto</option>
            </select>
            <input id="title" placeholder="Titulo" required>
            <input id="objective" placeholder="Objetivo">
            <textarea id="scope" placeholder="Scope operativo" required></textarea>
            <textarea id="constraints" placeholder="Restricciones"></textarea>
            <div class="split">
              <select id="stage">
                <option value="discover">Discover</option>
                <option value="plan" selected>Plan</option>
                <option value="build">Build</option>
                <option value="validate">Validate</option>
                <option value="launch">Launch</option>
              </select>
              <select id="riskLevel">
                <option value="low">Riesgo bajo</option>
                <option value="medium" selected>Riesgo medio</option>
                <option value="high">Riesgo alto</option>
              </select>
            </div>
            <button type="submit">Crear con ChatGPT</button>
          </form>
          <div class="stack">
            <h2>Agentes</h2>
            <div id="agents" class="list"></div>
          </div>
        </section>

        <section class="stack">
          <div class="grid2">
            <div id="projectDetail" class="surface stack"></div>
            <div class="stack">
              <h2>Tareas del proyecto</h2>
              <div id="projectTasks" class="stack scroll"></div>
            </div>
          </div>
          <div class="stack">
            <h2>Artifacts del proyecto</h2>
            <div id="projectArtifacts" class="stack scroll"></div>
          </div>
          <div class="row" style="justify-content:space-between">
            <h2>Misiones</h2>
            <button id="refresh" class="ghost" type="button">Actualizar</button>
          </div>
          <div class="grid2">
            <div id="missions" class="list"></div>
            <div id="missionDetail" class="stack"></div>
          </div>
          <div class="stack">
            <h2>Plan operativo</h2>
            <div id="steps" class="stack"></div>
          </div>
          <div class="grid2">
            <div class="stack">
              <h2>Asignaciones</h2>
              <div id="assignments" class="stack"></div>
            </div>
            <div class="stack">
              <h2>Outputs</h2>
              <div id="outputs" class="stack"></div>
            </div>
          </div>
          <div class="grid2">
            <div class="stack">
              <h2>Memoria del proyecto</h2>
              <div id="memory" class="surface scroll"></div>
            </div>
            <div class="stack">
              <h2>Historial IA</h2>
              <div id="history" class="stack scroll"></div>
            </div>
          </div>
        </section>

        <section class="stack">
          <h2>ChatGPT Ops</h2>
          <textarea id="runInstruction" placeholder="Instruccion para este ciclo"></textarea>
          <button id="runMission" type="button">Ejecutar ciclo IA</button>
          <div id="runResult" class="surface scroll"><pre></pre></div>
          <h2>Consulta</h2>
          <textarea id="chatMessage" placeholder="Pregunta operativa"></textarea>
          <button id="sendChat" class="secondary" type="button">Responder</button>
          <div id="chatResult" class="surface scroll"><pre></pre></div>
          <h2>Delegacion rapida</h2>
          <textarea id="initiative" placeholder="Describe una iniciativa"></textarea>
          <button id="delegate" class="ghost" type="button">Delegar</button>
          <div id="delegateResult" class="surface scroll"><pre></pre></div>
        </section>
      </div>
    </main>
    <script>
      const state = {
        token: localStorage.getItem('missionControlToken') || '',
        projects: [],
        selectedProjectId: '',
        currentProject: null,
        missions: [],
        selectedId: '',
        currentMission: null
      };

      const $ = (id) => document.getElementById(id);
      $('token').value = state.token;

      function headers() {
        const result = { 'content-type': 'application/json' };
        if (state.token) result.authorization = 'Bearer ' + state.token;
        return result;
      }

      async function request(path, options = {}) {
        const res = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error || data.detail || text || 'Request failed');
        return data;
      }

      function badge(id, ok, label) {
        const el = $(id);
        el.className = 'badge ' + (ok ? 'ok' : 'warn');
        el.textContent = label;
      }

      function print(id, value) {
        $(id).querySelector('pre').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      }

      function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[char]);
      }

      async function loadStatus() {
        const status = await request('/api/status');
        badge('aiStatus', status.openai.configured, status.openai.configured ? 'ChatGPT listo' : 'OPENAI_API_KEY falta');
        badge('dbStatus', status.supabase.configured, status.supabase.configured ? 'Supabase listo' : 'Supabase local');
      }

      async function loadAgents() {
        const agents = await request('/api/agents');
        $('agents').innerHTML = agents.map((agent) =>
          '<div class="item"><strong>' + esc(agent.name) + '</strong><span class="muted">' + esc(agent.domain) + '</span></div>'
        ).join('');
      }

      async function loadProjects() {
        state.projects = await request('/api/projects');
        if (!state.selectedProjectId && state.projects[0]) state.selectedProjectId = state.projects[0].id;
        renderProjects();
        renderProjectSelect();
        if (state.selectedProjectId) {
          await selectProject(state.selectedProjectId);
        } else {
          $('projectDetail').innerHTML = '<div class="empty">Crea o selecciona un proyecto.</div>';
          $('projectTasks').innerHTML = '<div class="empty">Sin tareas todavia.</div>';
          $('projectArtifacts').innerHTML = '<div class="empty">Sin artifacts todavia.</div>';
          await loadMissions();
        }
      }

      function renderProjectSelect() {
        $('projectSelect').innerHTML = '<option value="">Sin proyecto</option>' + state.projects.map((project) =>
          '<option value="' + esc(project.id) + '"' + (project.id === state.selectedProjectId ? ' selected' : '') + '>' + esc(project.name) + '</option>'
        ).join('');
      }

      function renderProjects() {
        $('projects').innerHTML = state.projects.length ? state.projects.map((project) =>
          '<button class="item ' + (project.id === state.selectedProjectId ? 'active' : '') + '" data-project-id="' + project.id + '">' +
          '<strong>' + esc(project.name) + '</strong>' +
          '<span class="muted">' + esc(project.framework || project.projectType || 'general') + ' / ' + esc(project.status || 'active') + ' / ' + esc(project.subdomain || '') + '</span>' +
          '</button>'
        ).join('') : '<div class="empty">Sin proyectos</div>';
        document.querySelectorAll('[data-project-id]').forEach((button) => {
          button.addEventListener('click', () => selectProject(button.dataset.projectId));
        });
      }

      async function selectProject(id) {
        state.selectedProjectId = id;
        renderProjects();
        renderProjectSelect();
        const project = await request('/api/projects/' + id);
        state.currentProject = project;
        const provisioning = project.provisioningStatus || {};
        $('projectDetail').innerHTML =
          '<h2>' + esc(project.name) + '</h2>' +
          '<p class="muted">' + esc(project.objective || project.scopeDefinition || '') + '</p>' +
          '<div class="toolbar"><span class="badge">' + esc(project.framework || 'cloudflare-worker-supabase') + '</span><span class="badge">' + esc(project.riskLevel || 'medium') + '</span><span class="badge">' + esc(project.githubOrg || 'PALX-software') + '/' + esc(project.repoName || '') + '</span><span class="badge">' + esc(project.subdomain || '') + '</span></div>' +
          '<div class="toolbar"><span class="badge">GitHub ' + esc(provisioning.github?.status || 'pending') + '</span><span class="badge">Supabase ' + esc(provisioning.supabase?.status || 'pending') + '</span><span class="badge">Cloudflare ' + esc(provisioning.cloudflare?.status || 'pending') + '</span></div>' +
          '<div class="toolbar"><span class="badge">tareas ' + esc((project.tasks || []).length) + '</span><span class="badge">artifacts ' + esc((project.artifacts || []).length) + '</span></div>' +
          (project.learningSummary ? '<p>' + esc(project.learningSummary) + '</p>' : '');
        $('projectTasks').innerHTML = (project.tasks || []).map((task) =>
          '<div class="item"><strong>' + esc(task.title) + '</strong><span class="muted">' + esc(task.owner) + ' / ' + esc(task.priority) + ' / ' + esc(task.status) + '</span><p class="muted">' + esc(task.detail) + '</p></div>'
        ).join('') || '<div class="empty">Sin tareas todavia.</div>';
        $('projectArtifacts').innerHTML = (project.artifacts || []).map((artifact) =>
          '<div class="item"><strong>' + esc(artifact.name) + '</strong><span class="muted">' + esc(artifact.artifactType) + ' / ciclo ' + esc(artifact.sourceCycleNumber || '-') + '</span><p class="muted">' + esc(artifact.content).slice(0, 260) + '</p></div>'
        ).join('') || '<div class="empty">Sin artifacts todavia.</div>';
        state.missions = project.missions || [];
        if (!state.missions.some((mission) => mission.id === state.selectedId)) state.selectedId = state.missions[0]?.id || '';
        renderMissions();
        if (state.selectedId) await selectMission(state.selectedId);
      }

      async function loadMissions() {
        const qs = state.selectedProjectId ? '?projectId=' + encodeURIComponent(state.selectedProjectId) : '';
        state.missions = await request('/api/missions' + qs);
        if (!state.selectedId && state.missions[0]) state.selectedId = state.missions[0].id;
        renderMissions();
        if (state.selectedId) await selectMission(state.selectedId);
      }

      function renderMissions() {
        $('missions').innerHTML = state.missions.length ? state.missions.map((mission) =>
          '<button class="item ' + (mission.id === state.selectedId ? 'active' : '') + '" data-id="' + mission.id + '">' +
          '<strong>' + esc(mission.title) + '</strong>' +
          '<span class="muted">' + esc(mission.stage) + ' / ' + esc(mission.riskLevel) + ' / ' + esc(mission.aiStatus || 'new') + ' / ciclos ' + esc(mission.cycleCount || 0) + '</span>' +
          '</button>'
        ).join('') : '<div class="empty">Sin misiones</div>';
        document.querySelectorAll('[data-id]').forEach((button) => {
          button.addEventListener('click', () => selectMission(button.dataset.id));
        });
      }

      async function selectMission(id) {
        state.selectedId = id;
        renderMissions();
        const mission = await request('/api/missions/' + id);
        state.currentMission = mission;
        $('missionDetail').innerHTML =
          '<div class="surface stack">' +
          '<h2>' + esc(mission.title) + '</h2>' +
          '<p class="muted">' + esc(mission.summary || mission.scopeText || '') + '</p>' +
          '<div class="toolbar"><span class="badge">' + esc(mission.stage) + '</span><span class="badge">' + esc(mission.riskLevel) + '</span><span class="badge">' + esc(mission.aiModel || 'model pending') + '</span><span class="badge">ciclos ' + esc(mission.cycleCount || 0) + '</span></div>' +
          '</div>';
        $('steps').innerHTML = (mission.steps || []).map((step) =>
          '<div class="step"><span class="num">' + esc(step.position) + '</span><div><strong>' + esc(step.title) + '</strong><p class="muted">' + esc(step.detail) + '</p><small>' + esc(step.owner) + '</small></div><span class="status ' + esc(step.status) + '">' + esc(step.status) + '</span></div>'
        ).join('') || '<div class="empty">Sin plan</div>';
        $('assignments').innerHTML = (mission.assignments || []).map((assignment) =>
          '<div class="item"><strong>' + esc(assignment.agent) + '</strong><span class="muted">' + esc(assignment.nextAction) + '</span></div>'
        ).join('') || '<div class="empty">Sin asignaciones</div>';
        $('outputs').innerHTML = (mission.outputs || []).map((output) =>
          '<div class="item"><strong>' + esc(output.name) + '</strong><span class="muted">' + esc(output.outputType) + ' / ' + esc(output.status) + '</span></div>'
        ).join('') || '<div class="empty">Sin outputs</div>';
        $('memory').innerHTML = mission.learningSummary
          ? '<p>' + esc(mission.learningSummary) + '</p><div class="toolbar"><span class="badge">ciclos ' + esc(mission.cycleCount || 0) + '</span><span class="badge">' + esc(mission.lastCycleAt || 'sin ciclo') + '</span></div>'
          : '<div class="empty">Ejecuta un ciclo IA para crear memoria de este proyecto.</div>';
        $('history').innerHTML = (mission.runs || [])
          .filter((run) => run.cycleNumber || run.response?.cycleNumber)
          .map((run) => {
            const response = run.response || {};
            const cycle = run.cycleNumber || response.cycleNumber || '?';
            const brief = response.brief || run.prompt || '';
            const learning = response.learningSummary || '';
            return '<div class="item"><strong>Ciclo ' + esc(cycle) + ' · ' + esc(response.status || run.status) + '</strong><span class="muted">' + esc(run.instruction || run.prompt || '') + '</span><p class="muted">' + esc(brief) + '</p>' + (learning ? '<small>' + esc(learning) + '</small>' : '') + '</div>';
          })
          .join('') || '<div class="empty">Sin ciclos IA todavia.</div>';
      }

      $('saveToken').addEventListener('click', () => {
        state.token = $('token').value.trim();
        localStorage.setItem('missionControlToken', state.token);
      });

      $('refresh').addEventListener('click', loadMissions);

      $('projectSelect').addEventListener('change', async () => {
        state.selectedProjectId = $('projectSelect').value;
        if (state.selectedProjectId) {
          await selectProject(state.selectedProjectId);
        } else {
          await loadMissions();
        }
      });

      $('projectForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const project = await request('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: $('projectName').value,
            objective: $('projectObjective').value,
            scope: $('projectScope').value,
            audience: $('projectAudience').value,
            framework: $('projectFramework').value,
            repoName: $('projectRepoName').value,
            subdomain: $('projectSubdomain').value,
            constraints: $('projectConstraints').value,
            projectType: $('projectType').value,
            riskLevel: $('projectRiskLevel').value
          })
        });
        state.selectedProjectId = project.id;
        event.target.reset();
        await loadProjects();
      });

      $('missionForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const mission = await request('/api/missions', {
          method: 'POST',
          body: JSON.stringify({
            projectId: $('projectSelect').value || undefined,
            title: $('title').value,
            objective: $('objective').value,
            scope: $('scope').value,
            constraints: $('constraints').value,
            stage: $('stage').value,
            riskLevel: $('riskLevel').value
          })
        });
        state.selectedId = mission.id;
        event.target.reset();
        await loadProjects();
      });

      $('runMission').addEventListener('click', async () => {
        if (!state.selectedId) return;
        const result = await request('/api/missions/' + state.selectedId + '/run', {
          method: 'POST',
          body: JSON.stringify({ instruction: $('runInstruction').value })
        });
        print('runResult', result.run);
        await selectMission(state.selectedId);
        if (state.selectedProjectId) await selectProject(state.selectedProjectId);
      });

      $('sendChat').addEventListener('click', async () => {
        const result = await request('/api/chat', {
          method: 'POST',
          body: JSON.stringify({ missionId: state.selectedId, message: $('chatMessage').value })
        });
        print('chatResult', result.answer);
      });

      $('delegate').addEventListener('click', async () => {
        const result = await request('/api/delegate', {
          method: 'POST',
          body: JSON.stringify({ initiative: $('initiative').value })
        });
        print('delegateResult', result);
      });

      Promise.all([loadStatus(), loadAgents(), loadProjects()]).catch((error) => {
        print('runResult', error.message);
      });
    </script>
  </body>
</html>`;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return json({});
  }

  try {
    if (url.pathname === '/health') {
      return json({
        service: 'mission-control-worker',
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/api/status') {
      return json({
        service: 'mission-control-worker',
        supabase: { configured: Boolean(getSupabase(env)) },
        openai: {
          configured: Boolean(getOpenAi(env)),
          model: env.OPENAI_MODEL || defaultOpenAiModel
        },
        integrations: {
          github: {
            configured: Boolean(env.GITHUB_TOKEN),
            org: normalizeGithubOrg(env)
          },
          supabaseManagement: {
            configured: Boolean(env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_ORG_ID && env.SUPABASE_DB_PASSWORD)
          },
          cloudflare: {
            configured: Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID),
            zone: normalizeText(env.CLOUDFLARE_ZONE_NAME, defaultCloudflareZone)
          }
        },
        operatorToken: { required: Boolean(env.MISSION_CONTROL_OPERATOR_TOKEN) }
      });
    }

    if (url.pathname === '/api/agents' && request.method === 'GET') {
      return json(await listAgents(env));
    }

    if (url.pathname === '/api/agents' && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return addAgent(env, await readJson(request));
    }

    if (url.pathname === '/api/delegate' && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return delegateInitiative(env, await readJson(request));
    }

    if (url.pathname === '/api/projects' && request.method === 'GET') {
      return json(await listProjects(env));
    }

    if (url.pathname === '/api/projects' && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return createProject(env, await readJson(request));
    }

    const projectTasksMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
    if (projectTasksMatch && request.method === 'GET') {
      const tasks = await listProjectTasks(env, projectTasksMatch[1]);
      return tasks ? json(tasks) : json({ error: 'project not found' }, { status: 404 });
    }

    if (projectTasksMatch && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return createProjectTask(env, projectTasksMatch[1], await readJson(request));
    }

    const projectArtifactsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/artifacts$/);
    if (projectArtifactsMatch && request.method === 'GET') {
      const artifacts = await listProjectArtifacts(env, projectArtifactsMatch[1]);
      return artifacts ? json(artifacts) : json({ error: 'project not found' }, { status: 404 });
    }

    if (projectArtifactsMatch && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return createProjectArtifact(env, projectArtifactsMatch[1], await readJson(request));
    }

    const projectProvisionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/provision$/);
    if (projectProvisionMatch && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return provisionExistingProject(env, projectProvisionMatch[1]);
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === 'GET') {
      const project = await getProjectDetails(env, projectMatch[1]);
      return project ? json(project) : json({ error: 'project not found' }, { status: 404 });
    }

    if (url.pathname === '/api/missions' && request.method === 'GET') {
      return json(await listMissions(env, url.searchParams.get('projectId') || url.searchParams.get('project_id')));
    }

    if (url.pathname === '/api/missions' && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return createMission(env, await readJson(request));
    }

    const runsMatch = url.pathname.match(/^\/api\/missions\/([^/]+)\/runs$/);
    if (runsMatch && request.method === 'GET') {
      const runs = await listMissionRuns(env, runsMatch[1]);
      return runs ? json(runs) : json({ error: 'mission not found' }, { status: 404 });
    }

    const missionMatch = url.pathname.match(/^\/api\/missions\/([^/]+)$/);
    if (missionMatch && request.method === 'GET') {
      const mission = await getMissionDetails(env, missionMatch[1]);
      return mission ? json(mission) : json({ error: 'mission not found' }, { status: 404 });
    }

    const runMatch = url.pathname.match(/^\/api\/missions\/([^/]+)\/run$/);
    if (runMatch && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return runMission(env, runMatch[1], await readJson(request));
    }

    const stepMatch = url.pathname.match(/^\/api\/steps\/([^/]+)$/);
    if (stepMatch && request.method === 'PATCH') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return updateStep(env, stepMatch[1], await readJson(request));
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === 'PATCH') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return updateProjectTask(env, taskMatch[1], await readJson(request));
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return chatWithMission(env, await readJson(request));
    }

    if (url.pathname === '/') {
      return new Response(pageHtml(env), {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    return json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    return json(
      {
        error: 'mission_control_error',
        detail: error.message
      },
      { status: 500 }
    );
  }
}

export default {
  fetch: handleRequest
};
