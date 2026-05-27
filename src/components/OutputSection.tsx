import { FormEvent, useState } from "react";
import type { ProjectOutputRow } from "../services/missionControl";

type OutputFormState = Pick<ProjectOutputRow, "name" | "output_type" | "definition">;

const EMPTY: OutputFormState = { name: "", output_type: "doc", definition: "" };

type Props = {
  outputs: ProjectOutputRow[];
  onAdd: (form: OutputFormState) => Promise<void>;
  onDelete: (id: string) => void;
  loading: boolean;
};

export function OutputSection({ outputs, onAdd, onDelete, loading }: Props) {
  const [form, setForm] = useState<OutputFormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onAdd(form);
    setForm(EMPTY);
    setSubmitting(false);
  };

  return (
    <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-2">
      <h2 className="mb-3 text-lg font-semibold">Outputs del proyecto</h2>
      <form onSubmit={onSubmit} className="mb-3 grid gap-2 md:grid-cols-3">
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
          placeholder="Nombre output"
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          required
        />
        <select
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
          value={form.output_type}
          onChange={(e) => setForm((s) => ({ ...s, output_type: e.target.value as ProjectOutputRow["output_type"] }))}
        >
          <option value="doc">Documento</option>
          <option value="code">Código</option>
          <option value="qa_report">QA report</option>
          <option value="legal_review">Legal review</option>
          <option value="launch_asset">Launch asset</option>
        </select>
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
          placeholder="Definición"
          value={form.definition}
          onChange={(e) => setForm((s) => ({ ...s, definition: e.target.value }))}
          required
        />
        <button
          type="submit"
          disabled={submitting || loading}
          className="rounded bg-accent px-3 py-2 font-semibold text-black disabled:opacity-50 md:col-span-3"
        >
          {submitting ? "Agregando…" : "Agregar output"}
        </button>
      </form>
      <ul className="space-y-2 text-sm">
        {outputs.map((o) => (
          <li key={o.id} className="group flex items-center justify-between rounded bg-slate-900/70 px-3 py-2">
            <span>
              <strong>{o.name}</strong> · {o.output_type} · {o.definition}
            </span>
            <button
              type="button"
              onClick={() => onDelete(o.id)}
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
