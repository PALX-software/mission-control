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

const html = await worker.fetch(new Request('http://localhost/'), env);
if (html.status !== 200) {
  throw new Error(`Home page failed with ${html.status}`);
}

console.log('worker check ok');
