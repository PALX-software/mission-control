# Mission Control Core

Panel de administración para proyectos multi-agente con enfoque en:

- Definir **scope completo** por proyecto para diseñar prompts robustos.
- Descubrir features interactuando con el usuario durante discovery.
- Auto-definir cantidad/tipo de agentes por proyecto (StackTank).
- Definir salidas esperadas (outputs) desde el panel.
- Exigir conexión con repositorio GitHub para trazabilidad end-to-end.

## Stack

- **Frontend:** Vite + React + TailwindCSS
- **Core de orquestación:** StackTank (`src/core/stacktank.ts`)
- **Backend app-facing:** Supabase (DB + funciones de datos desde frontend)

## Configurar instalación sobre Supabase

### Opción A — Local (recomendada para desarrollo)

1. Instala Supabase CLI.
2. Ejecuta:

```bash
npm run setup:supabase
```

Este script realiza:
- `supabase start`
- `supabase db reset --local` (aplica migraciones)
- `supabase db seed --local`
- `supabase gen types typescript --local > src/lib/database.types.ts`

3. Levanta frontend:

```bash
npm install
npm run dev
```

### Opción B — Proyecto cloud en Supabase

1. Crea proyecto en Supabase y obtén:
   - `project-ref`
   - `anon key`
   - `db password`
2. Copia `.env.example` a `.env` y completa variables.
3. Linkea el repo local al proyecto cloud:

```bash
supabase link --project-ref <project-ref>
```

4. Empuja esquema:

```bash
supabase db push
```

5. (Opcional) Carga seed:

```bash
supabase db seed
```

## Esquema de datos actual

- `projects`
- `project_agents`
- `project_features`
- `project_outputs`
- `agents`
- `initiatives`
- `initiative_assignments`

Migraciones en `supabase/migrations`.

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF` (opcional para CI)
- `SUPABASE_ACCESS_TOKEN` (opcional para CI)
- `SUPABASE_DB_PASSWORD` (opcional para CI)

## Scripts útiles

- `npm run setup:supabase`
- `npm run supabase:start`
- `npm run supabase:stop`
- `npm run supabase:reset`
- `npm run supabase:types`

## Próximos pasos

- Mover funciones críticas de asignación a Supabase Edge Functions.
- Conectar ejecución de agentes con GitHub Actions + webhooks por output.
- Integrar gateway privado de Ollama en cloud aislada con auditoría.
