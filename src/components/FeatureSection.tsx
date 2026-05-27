import { FormEvent, useState } from "react";
import type { ProjectFeatureRow } from "../services/missionControl";

type FeatureFormState = Pick<ProjectFeatureRow, "title" | "detail" | "status">;

const EMPTY: FeatureFormState = { title: "", detail: "", status: "discovered" };

type Props = {
  features: ProjectFeatureRow[];
  onAdd: (form: FeatureFormState) => Promise<void>;
  onDelete: (id: string) => void;
  loading: boolean;
};

export function FeatureSection({ features, onAdd, onDelete, loading }: Props) {
  const [form, setForm] = useState<FeatureFormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onAdd(form);
    setForm(EMPTY);
    setSubmitting(false);
  };

  return (
    <section className="rounded-xl border border-slate-700 bg-panel p-4">
      <h2 className="mb-3 text-lg font-semibold">Feature discovery</h2>
      <form onSubmit={onSubmit} className="space-y-2">
        <input
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
          placeholder="Feature"
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          required
        />
        <textarea
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
          rows={2}
          placeholder="Detalle"
          value={form.detail}
          onChange={(e) => setForm((s) => ({ ...s, detail: e.target.value }))}
          required
        />
        <select
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
          value={form.status}
          onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as ProjectFeatureRow["status"] }))}
        >
          <option value="discovered">Discovered</option>
          <option value="ready">Ready</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
        <button
          type="submit"
          disabled={submitting || loading}
          className="rounded bg-accent px-3 py-2 font-semibold text-black disabled:opacity-50"
        >
          {submitting ? "Agregando…" : "Agregar feature"}
        </button>
      </form>
      <ul className="mt-3 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f.id} className="group flex items-center justify-between rounded bg-slate-900/70 px-3 py-2">
            <span>
              <strong>{f.title}</strong> · {f.status}
            </span>
            <button
              type="button"
              onClick={() => onDelete(f.id)}
              className="ml-3 rounded px-1.5 text-slate-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
