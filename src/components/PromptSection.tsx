import type { ProjectRow } from "../services/missionControl";

type Props = {
  project: ProjectRow | undefined;
  featureQuestions: string[];
};

export function PromptSection({ project, featureQuestions }: Props) {
  return (
    <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-3">
      <h2 className="mb-3 text-lg font-semibold">Scope, prompt y descubrimiento</h2>
      {project ? (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded border border-slate-700 bg-slate-950 p-3 text-sm">
            <h3 className="mb-2 font-semibold">Prompt blueprint</h3>
            <pre className="whitespace-pre-wrap text-slate-300">{project.prompt_blueprint}</pre>
          </article>
          <article className="rounded border border-slate-700 bg-slate-950 p-3 text-sm">
            <h3 className="mb-2 font-semibold">Preguntas para descubrir features</h3>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              {featureQuestions.length === 0 ? (
                <li>Crea un proyecto para generar preguntas de descubrimiento.</li>
              ) : (
                featureQuestions.map((q) => <li key={q}>{q}</li>)
              )}
            </ul>
          </article>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Selecciona o crea un proyecto.</p>
      )}
    </section>
  );
}
