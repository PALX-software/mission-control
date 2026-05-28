const fallbackAgents = [
  { name: 'Product Strategist', domain: 'Discovery, roadmap y priorizacion' },
  { name: 'Legal Guardian', domain: 'Riesgo legal, contratos y compliance' },
  { name: 'Marketing Ops', domain: 'Go-to-market y growth' },
  { name: 'UX/UI Designer', domain: 'Flujos, prototipos y diseno' },
  { name: 'Software Engineer', domain: 'Arquitectura e implementacion' },
  { name: 'QA Lead', domain: 'Pruebas, calidad y release readiness' }
];

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,apikey',
      ...init.headers
    }
  });
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

  if (!response.ok) {
    return undefined;
  }

  return response.json();
}

async function listAgents(env) {
  const data = await supabaseFetch(
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

  const data = await supabaseFetch(env, '/rest/v1/agents?select=name,role', {
    method: 'POST',
    body: JSON.stringify({
      name: agent.name,
      role: agent.domain,
      automation_level: 'hybrid'
    })
  });

  if (!Array.isArray(data) || !data[0]) {
    fallbackAgents.push(agent);
    return json(agent, { status: 201 });
  }

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

  if (/legal|compliance|contrato|riesgo/.test(signal)) picks.add('Legal Guardian');
  if (/go-to-market|growth|campana|campaign|ads|seo/.test(signal)) picks.add('Marketing Ops');
  if (/flujo|ui|ux|diseno|diseño|experiencia/.test(signal)) picks.add('UX/UI Designer');

  return Array.from(picks);
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
      :root{color-scheme:dark;--bg:#0b1120;--panel:#111827;--line:#334155;--accent:#67e8f9;--muted:#94a3b8}
      *{box-sizing:border-box}body{margin:0;background:var(--bg);color:#f8fafc;font-family:Inter,system-ui,sans-serif}
      main{max-width:1120px;margin:0 auto;padding:28px;display:grid;gap:18px}
      header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding-bottom:18px}
      h1,h2{margin:0}p{color:var(--muted)}section{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}input,textarea,button{width:100%;margin-top:10px;border:1px solid var(--line);border-radius:6px;padding:10px;background:#020617;color:#fff}
      button{background:var(--accent);border:0;color:#031016;font-weight:700;cursor:pointer}li{margin:8px 0}pre{white-space:pre-wrap;color:#dbeafe}
      @media (max-width:760px){.grid{grid-template-columns:1fr}header{display:block}}
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Mission Control</h1>
          <p>Agentes, delegacion y seguimiento operativo.</p>
        </div>
        <small>${appUrl}</small>
      </header>
      <div class="grid">
        <section>
          <h2>Agentes</h2>
          <ul id="agents"></ul>
          <input id="name" placeholder="Nombre">
          <input id="domain" placeholder="Dominio">
          <button id="add">Agregar agente</button>
        </section>
        <section>
          <h2>Delegacion</h2>
          <textarea id="initiative" rows="6" placeholder="Describe una iniciativa"></textarea>
          <button id="delegate">Delegar</button>
          <pre id="result"></pre>
        </section>
      </div>
    </main>
    <script>
      async function request(path, options) {
        const res = await fetch(path, options);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      }
      async function loadAgents() {
        const agents = await request('/api/agents');
        document.getElementById('agents').innerHTML = agents.map((agent) =>
          '<li><b>' + agent.name + '</b> · ' + agent.domain + '</li>'
        ).join('');
      }
      document.getElementById('add').addEventListener('click', async () => {
        await request('/api/agents', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('name').value,
            domain: document.getElementById('domain').value
          })
        });
        await loadAgents();
      });
      document.getElementById('delegate').addEventListener('click', async () => {
        const data = await request('/api/delegate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ initiative: document.getElementById('initiative').value })
        });
        document.getElementById('result').textContent = JSON.stringify(data, null, 2);
      });
      loadAgents().catch((error) => {
        document.getElementById('agents').innerHTML = '<li>' + error.message + '</li>';
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

  if (url.pathname === '/health') {
    return json({
      service: 'mission-control-worker',
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }

  if (url.pathname === '/api/agents' && request.method === 'GET') {
    return json(await listAgents(env));
  }

  if (url.pathname === '/api/agents' && request.method === 'POST') {
    return addAgent(env, await request.json());
  }

  if (url.pathname === '/api/delegate' && request.method === 'POST') {
    const payload = await request.json();
    return json({
      initiative: payload.initiative,
      delegatedTo: suggestDelegation(payload.initiative)
    });
  }

  if (url.pathname === '/') {
    return new Response(pageHtml(env), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  }

  return json({ error: 'Not found' }, { status: 404 });
}

export default {
  fetch: handleRequest
};
