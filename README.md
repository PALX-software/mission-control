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

Cloudflare DNS tiene `mission-control.zeqhora.com` como CNAME DNS-only hacia `vhqgiqluotnxkepmrntm.supabase.co`.

Para activar ese hostname como dominio custom de Supabase, el proyecto debe estar en un plan/add-on compatible con Custom Domains. Despues de activar el plan, registra `mission-control.zeqhora.com` en Supabase, agrega el TXT `_acme-challenge` que Supabase entregue y ejecuta la verificacion/activacion desde el dashboard o CLI.
