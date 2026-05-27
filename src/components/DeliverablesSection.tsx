export type StageKey = "discover" | "plan" | "build" | "validate" | "launch";

const defaultDeliverables: Record<StageKey, string[]> = {
  discover: ["Project brief", "Research plan", "Initial feature map"],
  plan: ["Prompt blueprint", "Agent plan", "Risk & legal checklist"],
  build: ["Architecture", "Implementation backlog", "QA strategy"],
  validate: ["Validation report", "Security check", "Acceptance matrix"],
  launch: ["Deployment runbook", "KPI dashboard", "v2 opportunities"],
};

type Props = {
  stage: StageKey;
  onStageChange: (stage: StageKey) => void;
};

export function DeliverablesSection({ stage, onStageChange }: Props) {
  return (
    <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-3">
      <h2 className="mb-3 text-lg font-semibold">Entregables evolutivos por etapa</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(defaultDeliverables) as StageKey[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded border px-3 py-1 text-sm ${
              stage === item ? "border-accent text-accent" : "border-slate-700"
            }`}
            onClick={() => onStageChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <ul className="list-disc space-y-1 pl-5 text-slate-300">
        {defaultDeliverables[stage].map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </section>
  );
}
