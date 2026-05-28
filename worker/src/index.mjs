const fallbackAgents = [
  { name: 'Product Strategist', domain: 'Discovery, roadmap y priorizacion' },
  { name: 'Legal Guardian', domain: 'Riesgo legal, contratos y compliance' },
  { name: 'Marketing Ops', domain: 'Go-to-market y growth' },
  { name: 'UX/UI Designer', domain: 'Flujos, prototipos y diseno' },
  { name: 'Software Engineer', domain: 'Arquitectura e implementacion' },
  { name: 'QA Lead', domain: 'Pruebas, calidad y release readiness' }
];

const fallbackMissions = [];
const stages = ['discover', 'plan', 'build', 'validate', 'launch'];
const riskLevels = ['low', 'medium', 'high'];
const taskStatuses = ['queued', 'running', 'blocked', 'done'];
const outputTypes = ['doc', 'code', 'qa_report', 'legal_review', 'launch_asset'];
const defaultOpenAiModel = 'gpt-5.2-chat-latest';

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
    required: ['brief', 'status', 'completedSteps', 'updatedSteps', 'nextActions', 'risks', 'artifacts'],
    properties: {
      brief: { type: 'string' },
      status: { type: 'string', enum: ['running', 'blocked', 'done'] },
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

function mapMissionRow(row) {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective || '',
    scopeText: row.scope_text,
    stage: row.stage,
    riskLevel: row.risk_level,
    summary: row.summary || '',
    aiStatus: row.ai_status || '',
    aiModel: row.ai_model || '',
    aiResponse: row.ai_response || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
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

async function storeAiRun(env, payload) {
  if (!getSupabase(env)) {
    return undefined;
  }

  return supabaseFetch(env, '/rest/v1/ai_runs?select=*', {
    method: 'POST',
    body: JSON.stringify({
      initiative_id: payload.initiativeId,
      provider: 'openai',
      model: payload.model,
      status: payload.status,
      prompt: payload.prompt,
      response: payload.response,
      error_text: payload.errorText || null,
      completed_at: new Date().toISOString()
    })
  });
}

async function createMission(env, payload) {
  const title = normalizeText(payload.title);
  const scopeText = missionScopeText(payload);

  if (!title || !scopeText) {
    return json({ error: 'title and scope are required' }, { status: 400 });
  }

  const agents = await listAgents(env);
  const plan = await buildMissionPlan(env, payload, agents);

  if (!getSupabase(env)) {
    return json(buildFallbackMission(payload, plan), { status: 201 });
  }

  const initiativeRows = await supabaseFetch(env, '/rest/v1/initiatives?select=*', {
    method: 'POST',
    body: JSON.stringify({
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
      response: plan,
      errorText: plan.aiError
    })
  ]);

  return json(await getMissionDetails(env, initiativeId), { status: 201 });
}

async function listMissions(env) {
  if (!getSupabase(env)) {
    return fallbackMissions;
  }

  const data = await safeSupabaseFetch(
    env,
    '/rest/v1/initiatives?select=id,title,objective,scope_text,stage,risk_level,summary,ai_status,ai_model,ai_response,created_at,updated_at&order=created_at.desc&limit=50'
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
      `/rest/v1/ai_runs?initiative_id=eq.${encodeURIComponent(id)}&select=*&order=started_at.desc&limit=10`
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
    runs: safeArray(runRows)
  };
}

async function runMission(env, missionId, payload) {
  const mission = await getMissionDetails(env, missionId);

  if (!mission) {
    return json({ error: 'mission not found' }, { status: 404 });
  }

  const input = JSON.stringify(
    {
      mission,
      instruction: normalizeText(payload.instruction, 'Ejecuta el siguiente avance operativo.')
    },
    null,
    2
  );
  const result = await callOpenAiJson(env, {
    schemaName: 'mission_control_run',
    schema: missionRunSchema(),
    instructions:
      'Eres Mission Control ejecutando un ciclo de avance. No inventes integraciones externas ya completadas. Genera evidencia, siguientes acciones y riesgos para que el equipo pueda avanzar.',
    input,
    maxOutputTokens: 2200
  });
  const run = result.ok
    ? {
        ...result.data,
        source: 'openai',
        aiStatus: 'executed',
        aiModel: result.model
      }
    : {
        brief: 'La mision quedo en cola porque falta configurar OPENAI_API_KEY o la llamada a OpenAI fallo.',
        status: 'blocked',
        completedSteps: [],
        updatedSteps: [],
        nextActions: ['Configurar OPENAI_API_KEY como secreto del Worker y reintentar.'],
        risks: [result.reason || result.error || 'openai_unavailable'],
        artifacts: [],
        source: 'fallback',
        aiStatus: 'fallback',
        aiModel: result.model || defaultOpenAiModel
      };

  if (getSupabase(env)) {
    await Promise.all([
      supabaseFetch(env, `/rest/v1/initiatives?id=eq.${encodeURIComponent(missionId)}&select=*`, {
        method: 'PATCH',
        body: JSON.stringify({
          ai_status: run.aiStatus,
          ai_model: run.aiModel,
          ai_response: {
            ...(mission.aiResponse || {}),
            lastRun: run
          },
          updated_at: new Date().toISOString()
        })
      }),
      storeAiRun(env, {
        initiativeId: missionId,
        model: run.aiModel,
        status: result.ok ? 'completed' : 'fallback',
        prompt: normalizeText(payload.instruction, 'run mission'),
        response: run,
        errorText: result.ok ? undefined : result.reason || result.error
      })
    ]);
  } else {
    const fallbackMission = fallbackMissions.find((item) => item.id === missionId);
    if (fallbackMission) {
      fallbackMission.aiStatus = run.aiStatus;
      fallbackMission.aiResponse = {
        ...(fallbackMission.aiResponse || {}),
        lastRun: run
      };
      fallbackMission.runs.unshift(run);
    }
  }

  return json({ missionId, run });
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
          <h2>Nueva mision</h2>
          <form id="missionForm" class="stack">
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
        missions: [],
        selectedId: ''
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

      async function loadStatus() {
        const status = await request('/api/status');
        badge('aiStatus', status.openai.configured, status.openai.configured ? 'ChatGPT listo' : 'OPENAI_API_KEY falta');
        badge('dbStatus', status.supabase.configured, status.supabase.configured ? 'Supabase listo' : 'Supabase local');
      }

      async function loadAgents() {
        const agents = await request('/api/agents');
        $('agents').innerHTML = agents.map((agent) =>
          '<div class="item"><strong>' + agent.name + '</strong><span class="muted">' + agent.domain + '</span></div>'
        ).join('');
      }

      async function loadMissions() {
        state.missions = await request('/api/missions');
        if (!state.selectedId && state.missions[0]) state.selectedId = state.missions[0].id;
        renderMissions();
        if (state.selectedId) await selectMission(state.selectedId);
      }

      function renderMissions() {
        $('missions').innerHTML = state.missions.length ? state.missions.map((mission) =>
          '<button class="item ' + (mission.id === state.selectedId ? 'active' : '') + '" data-id="' + mission.id + '">' +
          '<strong>' + mission.title + '</strong>' +
          '<span class="muted">' + mission.stage + ' / ' + mission.riskLevel + ' / ' + (mission.aiStatus || 'new') + '</span>' +
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
        $('missionDetail').innerHTML =
          '<div class="surface stack">' +
          '<h2>' + mission.title + '</h2>' +
          '<p class="muted">' + (mission.summary || mission.scopeText || '') + '</p>' +
          '<div class="toolbar"><span class="badge">' + mission.stage + '</span><span class="badge">' + mission.riskLevel + '</span><span class="badge">' + (mission.aiModel || 'model pending') + '</span></div>' +
          '</div>';
        $('steps').innerHTML = (mission.steps || []).map((step) =>
          '<div class="step"><span class="num">' + step.position + '</span><div><strong>' + step.title + '</strong><p class="muted">' + step.detail + '</p><small>' + step.owner + '</small></div><span class="status ' + step.status + '">' + step.status + '</span></div>'
        ).join('') || '<div class="empty">Sin plan</div>';
        $('assignments').innerHTML = (mission.assignments || []).map((assignment) =>
          '<div class="item"><strong>' + assignment.agent + '</strong><span class="muted">' + assignment.nextAction + '</span></div>'
        ).join('') || '<div class="empty">Sin asignaciones</div>';
        $('outputs').innerHTML = (mission.outputs || []).map((output) =>
          '<div class="item"><strong>' + output.name + '</strong><span class="muted">' + output.outputType + ' / ' + output.status + '</span></div>'
        ).join('') || '<div class="empty">Sin outputs</div>';
      }

      $('saveToken').addEventListener('click', () => {
        state.token = $('token').value.trim();
        localStorage.setItem('missionControlToken', state.token);
      });

      $('refresh').addEventListener('click', loadMissions);

      $('missionForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const mission = await request('/api/missions', {
          method: 'POST',
          body: JSON.stringify({
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
        await loadMissions();
      });

      $('runMission').addEventListener('click', async () => {
        if (!state.selectedId) return;
        const result = await request('/api/missions/' + state.selectedId + '/run', {
          method: 'POST',
          body: JSON.stringify({ instruction: $('runInstruction').value })
        });
        print('runResult', result.run);
        await selectMission(state.selectedId);
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

      Promise.all([loadStatus(), loadAgents(), loadMissions()]).catch((error) => {
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

    if (url.pathname === '/api/missions' && request.method === 'GET') {
      return json(await listMissions(env));
    }

    if (url.pathname === '/api/missions' && request.method === 'POST') {
      const guard = guardOperator(request, env);
      if (guard) return guard;
      return createMission(env, await readJson(request));
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
