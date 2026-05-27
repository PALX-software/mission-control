#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "[ERROR] Supabase CLI no está instalado."
  echo "Instala con: brew install supabase/tap/supabase o npm i -g supabase"
  exit 1
fi

echo "[1/5] Iniciando stack local de Supabase..."
supabase start

echo "[2/5] Aplicando migraciones locales..."
supabase db reset --local

echo "[3/5] Cargando seed de ejemplo..."
supabase db seed --local

echo "[4/5] Generando tipos TypeScript..."
supabase gen types typescript --local > src/lib/database.types.ts

echo "[5/5] Listo. Actualiza .env con las credenciales locales o cloud."
supabase status
