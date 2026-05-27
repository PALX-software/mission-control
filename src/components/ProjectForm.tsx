import { FormEvent } from "react";
import type { ProjectRow } from "../services/missionControl";

type ProjectFormState = Omit<ProjectRow, "id" | "prompt_blueprint">;

type Props = {
  value: ProjectFormState;
  onChange: (update: Partial<ProjectFormState>) => void;
  onSubmit: (e: FormEvent) => void;
  loading: boolean;
};

export function ProjectForm({ value, onChange, onSubmit, loading }: Props) {
  return (
    <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-2">
      <h2 className="mb-3 text-lg font-semibold">Nuevo proyecto</h2>
      <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-2">
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
          placeholder="Nombre del proyecto"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
          placeholder="Audiencia objetivo"
          value={value.audience}
          onChange={(e) => onChange({ audience: e.target.value })}
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
          placeholder="Objetivo de negocio"
          value={value.objective}
          onChange={(e) => onChange({ objective: e.target.value })}
          required
        />
        <textarea
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
          placeholder="Scope funcional completo"
          rows={3}
          value={value.scope_definition}
          onChange={(e) => onChange({ scope_definition: e.target.value })}
          required
        />
        <textarea
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
          placeholder="Restricciones técnicas, legales, presupuesto, timeline"
          rows={2}
          value={value.constraints}
          onChange={(e) => onChange({ constraints: e.target.value })}
          required
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
          placeholder="Repositorio GitHub (https://github.com/org/repo)"
          value={value.github_repo}
          onChange={(e) => onChange({ github_repo: e.target.value })}
          required
        />
        <select
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
          value={value.risk_level}
          onChange={(e) => onChange({ risk_level: e.target.value as ProjectRow["risk_level"] })}
        >
          <option value="low">Riesgo bajo</option>
          <option value="medium">Riesgo medio</option>
          <option value="high">Riesgo alto</option>
        </select>
        <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
          <input
            type="checkbox"
            checked={value.discovery_mode}
            onChange={(e) => onChange({ discovery_mode: e.target.checked })}
          />
          Discovery interactivo activo
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-accent px-3 py-2 font-semibold text-black disabled:opacity-50 md:col-span-2"
        >
          {loading ? "Creando…" : "Crear proyecto + plan de agentes"}
        </button>
      </form>
    </section>
  );
}
