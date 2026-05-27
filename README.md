# Mission Control (NestJS Fullstack)

Refactor completo a arquitectura **NestJS para backend y frontend** con camino de despliegue a producción en contenedores.

## Estructura

- `backend/`: API NestJS para agentes, delegación y healthcheck.
- `frontend/`: Servidor web NestJS (SSR con EJS) que consume la API.
- `deploy/docker-compose.prod.yml`: stack de producción para levantar frontend+backend.

## Backend (puerto 3001)

Endpoints:

- `GET /api/agents`
- `POST /api/agents`
- `POST /api/delegate`
- `GET /health`

## Frontend (puerto 3000)

- Renderiza dashboard inicial.
- Permite alta de agentes.
- Ejecuta delegación automática consultando backend.
- Health endpoint: `GET /health`.

## Ejecutar en local (desarrollo)

```bash
npm install
npm run build
npm run start:backend
npm run start:frontend
```

## Despliegue a producción (Docker Compose)

1. Configura variables de entorno:

```bash
cp .env.production.example .env.production
```

2. Levanta stack de producción:

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
```

3. Verifica salud:

```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

## Siguiente fase (Ollama privado)

1. Introducir cola de trabajos (Redis/NATS) para agentes.
2. Ejecutores por rol con contratos de entrada/salida versionados.
3. Gateway privado para Ollama en VPC aislada con auditoría.
4. Política de seguridad: cifrado, masking PII y trazabilidad por tarea.
