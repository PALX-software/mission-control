import type { ProjectRow } from "../services/missionControl";

type Props = {
  projects: ProjectRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
};

export function ProjectList({ projects, selectedId, onSelect, onDelete, loading }: Props) {
  return (
    <section className="rounded-xl border border-slate-700 bg-panel p-4">
      <h2 className="mb-3 text-lg font-semibold">Proyectos</h2>
      {loading && <p className="text-sm text-slate-400">Cargando…</p>}
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(project.id)}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${
                selectedId === project.id ? "border-accent text-accent" : "border-slate-700"
              }`}
            >
              <div className="font-semibold">{project.name}</div>
              <div className="truncate text-xs text-slate-400">{project.github_repo}</div>
            </button>
            <button
              type="button"
              title="Eliminar proyecto"
              onClick={() => onDelete(project.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-slate-500 opacity-0 hover:bg-red-900/40 hover:text-red-400 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
