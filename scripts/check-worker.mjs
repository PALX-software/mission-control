import worker from '../worker/src/index.mjs';

const env = {
  PUBLIC_APP_URL: 'http://localhost',
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: ''
};

const health = await worker.fetch(new Request('http://localhost/health'), env);
if (health.status !== 200) {
  throw new Error(`Health check failed with ${health.status}`);
}

const agents = await worker.fetch(new Request('http://localhost/api/agents'), env);
if (agents.status !== 200) {
  throw new Error(`Agents endpoint failed with ${agents.status}`);
}

const status = await worker.fetch(new Request('http://localhost/api/status'), env);
if (status.status !== 200) {
  throw new Error(`Status endpoint failed with ${status.status}`);
}

const delegate = await worker.fetch(
  new Request('http://localhost/api/delegate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initiative: 'Preparar lanzamiento con QA y marketing' })
  }),
  env
);
if (delegate.status !== 200) {
  throw new Error(`Delegate endpoint failed with ${delegate.status}`);
}

const mission = await worker.fetch(
  new Request('http://localhost/api/missions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Smoke mission',
      objective: 'Validar el Worker',
      scope: 'Crear un plan operativo minimo para comprobar rutas',
      stage: 'plan',
      riskLevel: 'medium'
    })
  }),
  env
);
if (mission.status !== 201) {
  throw new Error(`Missions endpoint failed with ${mission.status}`);
}

const html = await worker.fetch(new Request('http://localhost/'), env);
if (html.status !== 200) {
  throw new Error(`Home page failed with ${html.status}`);
}

console.log('worker check ok');
