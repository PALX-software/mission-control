# Mission Control

Panel operativo para crear misiones, delegarlas a agentes, generar planes con ChatGPT y guardar el historial en Supabase. Produccion corre como Cloudflare Worker en `mission-control.zeqhora.com`.

## Estructura

- `worker/`: app principal en Cloudflare Workers para `mission-control.zeqhora.com`.
- `backend/`: API NestJS alternativa para agentes, delegacion y healthcheck.
- `frontend/`: servidor web NestJS con EJS que consume la API alternativa.
- `supabase/`: migraciones y seed de datos base.
- `deploy/docker-compose.prod.yml`: stack de produccion para frontend + backend.

## Supabase

Proyecto enlazado:

- Project ref: `vhqgiqluotnxkepmrntm`
- URL: `https://vhqgiqluotnxkepmrntm.supabase.co`

Variables requeridas en produccion:

```bash
SUPABASE_URL=https://vhqgiqluotnxkepmrntm.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
```

`SUPABASE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` son opcionales y solo deben usarse en backend si se requiere acceso privilegiado.

## Capa IA

El Worker usa OpenAI Responses API como capa ChatGPT para:

- Crear misiones con resumen, riesgo, plan, agentes asignados, criterios de aceptacion y outputs.
- Ejecutar ciclos IA sobre una mision, guardar historial en `ai_runs` y actualizar memoria acumulada por proyecto.
- Responder consultas operativas con contexto de la mision seleccionada.
- Delegar iniciativas rapidas sin crear una mision persistente.

Cada ciclo IA:

- Recibe la mision, pasos, asignaciones, outputs, memoria acumulada y ciclos recientes.
- Devuelve avance, decisiones, hechos nuevos, riesgos, siguientes acciones y artifacts.
- Actualiza `learning_summary`, `cycle_count` y `last_cycle_at` en `initiatives`.
- Guarda un snapshot en `ai_runs` con `cycle_number`, `instruction`, `response` y `memory_snapshot`.

Variables/secrets:

```bash
OPENAI_MODEL=chat-latest
OPENAI_API_KEY=sk-...
MISSION_CONTROL_OPERATOR_TOKEN=...
```

`OPENAI_API_KEY` y `MISSION_CONTROL_OPERATOR_TOKEN` deben configurarse como secrets del Worker, no en Git. Si `OPENAI_API_KEY` falta, el sistema conserva un fallback deterministico para crear planes basicos, pero ChatGPT queda bloqueado hasta configurar el secreto.

## Backend (puerto 3001)

Endpoints:

- `GET /api/agents`
- `POST /api/agents`
- `POST /api/delegate`
- `GET /health`

## Frontend (puerto 3000)

- Renderiza dashboard inicial.
- Permite alta de agentes.
- Ejecuta delegacion automatica consultando backend.
- Health endpoint: `GET /health`.

## Ejecutar en local

```bash
npm install
npm run build
npm run start:backend
npm run start:frontend
```

## Despliegue a produccion (Docker Compose)

1. Configura variables:

```bash
cp .env.production.example .env.production
```

2. Levanta el stack:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
```

3. Verifica salud:

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

## Dominio

`worldcuptrading.zeqhora.com` esta configurado como Custom Domain de Cloudflare Worker. `mission-control.zeqhora.com` sigue el mismo patron: Worker `mission-control`, dominio custom `mission-control.zeqhora.com`, estado proxied, y variables/secrets en Cloudflare.

El repo incluye `wrangler.toml` y `worker/src/index.mjs` para desplegar en Cloudflare Workers:

```bash
npm run check:worker
npm run deploy:worker
```

Variables de Cloudflare Worker:

- `PUBLIC_APP_URL=https://mission-control.zeqhora.com`
- `SUPABASE_URL=https://vhqgiqluotnxkepmrntm.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=...`
- `OPENAI_MODEL=chat-latest`

Secrets de Cloudflare Worker:

- `OPENAI_API_KEY`
- `MISSION_CONTROL_OPERATOR_TOKEN`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Worker API

- `GET /health`
- `GET /api/status`
- `GET /api/agents`
- `POST /api/agents`
- `POST /api/delegate`
- `GET /api/missions`
- `POST /api/missions`
- `GET /api/missions/:id`
- `GET /api/missions/:id/runs`
- `POST /api/missions/:id/run`
- `PATCH /api/steps/:id`
- `POST /api/chat`
