# Mission Control (NestJS Fullstack)

Refactor completo a arquitectura **NestJS para backend y frontend**.

## Estructura

- `backend/`: API NestJS para agentes y delegación.
- `frontend/`: Servidor web NestJS (SSR con EJS) que consume la API.

## Backend (puerto 3001)

Endpoints:

- `GET /api/agents`
- `POST /api/agents`
- `POST /api/delegate`

## Frontend (puerto 3000)

- Renderiza dashboard inicial.
- Permite alta de agentes.
- Ejecuta delegación automática consultando backend.

## Ejecución

```bash
npm install
npm run build
npm run start:backend
npm run start:frontend
```

Opcional:

- `API_BASE_URL` para apuntar frontend a otra URL de backend.

## Siguiente fase (Ollama privado)

1. Introducir cola de trabajos (Redis/NATS) para agentes.
2. Ejecutores por rol con contratos de entrada/salida versionados.
3. Gateway privado para Ollama en VPC aislada con auditoría.
4. Política de seguridad: cifrado, masking PII, y trazabilidad por tarea.
