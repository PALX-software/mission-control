# Mission Control (NestJS Fullstack)

Arquitectura NestJS para backend y frontend con despliegue en contenedores y persistencia en Supabase.

## Estructura

- `backend/`: API NestJS para agentes, delegacion y healthcheck.
- `frontend/`: servidor web NestJS con EJS que consume la API.
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

`worldcuptrading.zeqhora.com` esta configurado como Custom Domain de Cloudflare Worker. `mission-control.zeqhora.com` debe seguir el mismo patron: Worker `mission-control`, dominio custom `mission-control.zeqhora.com`, estado proxied, y variables/secrets en Cloudflare.

El repo incluye `wrangler.toml` y `worker/src/index.mjs` para desplegar en Cloudflare Workers:

```bash
npm run check:worker
npm run deploy:worker
```

Variables de Cloudflare Worker:

- `PUBLIC_APP_URL=https://mission-control.zeqhora.com`
- `SUPABASE_URL=https://vhqgiqluotnxkepmrntm.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=...`

Secrets opcionales si el Worker necesita acceso privilegiado:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
