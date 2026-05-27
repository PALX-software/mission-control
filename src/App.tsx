import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createProject,
  createProjectFeature,
  createProjectOutput,
  fetchProjectFeatures,
  fetchProjectOutputs,
  fetchProjects,
  suggestFeatureQuestions,
  type ProjectFeatureRow,
  type ProjectOutputRow,
  type ProjectRow,
} from "./services/missionControl";

const defaultDeliverables: Record<string, string[]> = {
  discover: ["Project brief", "Research plan", "Initial feature map"],
  plan: ["Prompt blueprint", "Agent plan", "Risk & legal checklist"],
  build: ["Architecture", "Implementation backlog", "QA strategy"],
  validate: ["Validation report", "Security check", "Acceptance matrix"],
  launch: ["Deployment runbook", "KPI dashboard", "v2 opportunities"],
};

type StageKey = keyof typeof defaultDeliverables;

function App() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectFeatures, setProjectFeatures] = useState<ProjectFeatureRow[]>([]);
  const [projectOutputs, setProjectOutputs] = useState<ProjectOutputRow[]>([]);
  const [featureQuestions, setFeatureQuestions] = useState<string[]>([]);
  const [stage, setStage] = useState<StageKey>("discover");

  const [projectForm, setProjectForm] = useState({
    name: "",
    objective: "",
    scope_definition: "",
    audience: "",
    constraints: "",
    risk_level: "medium" as const,
    discovery_mode: true,
    github_repo: "",
  });

  const [featureForm, setFeatureForm] = useState({
    title: "",
    detail: "",
    status: "discovered" as const,
  });

  const [outputForm, setOutputForm] = useState({
    name: "",
    output_type: "doc" as const,
    definition: "",
  });

  useEffect(() => {
    fetchProjects().then((res) => {
      if (res.data) {
        setProjects(res.data);
        if (res.data[0]) setSelectedProjectId(res.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchProjectFeatures(selectedProjectId).then((res) => res.data && setProjectFeatures(res.data));
    fetchProjectOutputs(selectedProjectId).then((res) => res.data && setProjectOutputs(res.data));
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const deliverables = useMemo(() => defaultDeliverables[stage], [stage]);

  const onCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectForm.github_repo.includes("github.com/")) {
      alert("El proyecto debe estar conectado a un repositorio de GitHub (URL completa).");
      return;
    }

    const res = await createProject(projectForm);
    if (!res.data) return;

    const created = res.data as ProjectRow;
    setProjects((prev) => [created, ...prev]);
    setSelectedProjectId(created.id);

    const questions = await suggestFeatureQuestions({
      projectName: created.name,
      projectScope: created.scope_definition,
      objective: created.objective,
      constraints: created.constraints,
      audience: created.audience,
      riskLevel: created.risk_level,
      discoveryMode: created.discovery_mode,
    });

    setFeatureQuestions(questions);
    setProjectForm({
      name: "",
      objective: "",
      scope_definition: "",
      audience: "",
      constraints: "",
      risk_level: "medium",
      discovery_mode: true,
      github_repo: "",
    });
  };

  const onCreateFeature = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return;

    const res = await createProjectFeature({ ...featureForm, project_id: selectedProjectId });
    if (res.data) {
      setProjectFeatures((prev) => [...prev, res.data as ProjectFeatureRow]);
      setFeatureForm({ title: "", detail: "", status: "discovered" });
    }
  };

  const onCreateOutput = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return;

    const res = await createProjectOutput({ ...outputForm, project_id: selectedProjectId });
    if (res.data) {
      setProjectOutputs((prev) => [...prev, res.data as ProjectOutputRow]);
      setOutputForm({ name: "", output_type: "doc", definition: "" });
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6 rounded-xl border border-slate-700 bg-panel p-5">
        <h1 className="text-2xl font-bold">Mission Control Panel · Gestión de Proyectos y Scope</h1>
        <p className="mt-2 text-slate-300">
          Define proyectos con contexto completo, genera mejor prompt base, descubre features con interacción guiada y
          conecta siempre a GitHub.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Nuevo proyecto (definición completa)</h2>
          <form onSubmit={onCreateProject} className="grid gap-2 md:grid-cols-2">
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
              placeholder="Nombre del proyecto"
              value={projectForm.name}
              onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
              placeholder="Audiencia objetivo"
              value={projectForm.audience}
              onChange={(e) => setProjectForm((s) => ({ ...s, audience: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
              placeholder="Objetivo de negocio"
              value={projectForm.objective}
              onChange={(e) => setProjectForm((s) => ({ ...s, objective: e.target.value }))}
              required
            />
            <textarea
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
              placeholder="Scope funcional completo para diseñar prompt"
              rows={3}
              value={projectForm.scope_definition}
              onChange={(e) => setProjectForm((s) => ({ ...s, scope_definition: e.target.value }))}
              required
            />
            <textarea
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
              placeholder="Restricciones técnicas, legales, presupuesto, timeline"
              rows={2}
              value={projectForm.constraints}
              onChange={(e) => setProjectForm((s) => ({ ...s, constraints: e.target.value }))}
              required
            />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2 md:col-span-2"
              placeholder="Repositorio GitHub (https://github.com/org/repo)"
              value={projectForm.github_repo}
              onChange={(e) => setProjectForm((s) => ({ ...s, github_repo: e.target.value }))}
              required
            />
            <select
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
              value={projectForm.risk_level}
              onChange={(e) => setProjectForm((s) => ({ ...s, risk_level: e.target.value as ProjectRow["risk_level"] }))}
            >
              <option value="low">Riesgo bajo</option>
              <option value="medium">Riesgo medio</option>
              <option value="high">Riesgo alto</option>
            </select>
            <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
              <input
                type="checkbox"
                checked={projectForm.discovery_mode}
                onChange={(e) => setProjectForm((s) => ({ ...s, discovery_mode: e.target.checked }))}
              />
              Discovery interactivo activo
            </label>
            <button className="rounded bg-accent px-3 py-2 font-semibold text-black md:col-span-2">
              Crear proyecto + plan de agentes
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-700 bg-panel p-4">
          <h2 className="mb-3 text-lg font-semibold">Proyectos</h2>
          <ul className="space-y-2">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    selectedProjectId === project.id ? "border-accent text-accent" : "border-slate-700"
                  }`}
                >
                  <div className="font-semibold">{project.name}</div>
                  <div className="text-xs text-slate-400">{project.github_repo}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Scope, prompt y descubrimiento</h2>
          {selectedProject ? (
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded border border-slate-700 bg-slate-950 p-3 text-sm">
                <h3 className="mb-2 font-semibold">Prompt blueprint</h3>
                <pre className="whitespace-pre-wrap text-slate-300">{selectedProject.prompt_blueprint}</pre>
              </article>
              <article className="rounded border border-slate-700 bg-slate-950 p-3 text-sm">
                <h3 className="mb-2 font-semibold">Preguntas para descubrir nuevos features</h3>
                <ul className="list-disc space-y-1 pl-5 text-slate-300">
                  {featureQuestions.length === 0 ? (
                    <li>Crea un proyecto para generar preguntas de descubrimiento.</li>
                  ) : (
                    featureQuestions.map((question) => <li key={question}>{question}</li>)
                  )}
                </ul>
              </article>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Aún no hay proyectos creados.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Definir salidas / outputs del proyecto</h2>
          <form onSubmit={onCreateOutput} className="mb-3 grid gap-2 md:grid-cols-3">
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
              placeholder="Nombre output"
              value={outputForm.name}
              onChange={(e) => setOutputForm((s) => ({ ...s, name: e.target.value }))}
              required
            />
            <select
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
              value={outputForm.output_type}
              onChange={(e) => setOutputForm((s) => ({ ...s, output_type: e.target.value as ProjectOutputRow["output_type"] }))}
            >
              <option value="doc">Documento</option>
              <option value="code">Código</option>
              <option value="qa_report">QA report</option>
              <option value="legal_review">Legal review</option>
              <option value="launch_asset">Launch asset</option>
            </select>
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-2"
              placeholder="Definición de salida"
              value={outputForm.definition}
              onChange={(e) => setOutputForm((s) => ({ ...s, definition: e.target.value }))}
              required
            />
            <button className="rounded bg-accent px-3 py-2 font-semibold text-black md:col-span-3">Agregar output</button>
          </form>
          <ul className="space-y-2 text-sm">
            {projectOutputs.map((output) => (
              <li key={output.id} className="rounded bg-slate-900/70 px-3 py-2">
                <strong>{output.name}</strong> · {output.output_type} · {output.definition}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-700 bg-panel p-4">
          <h2 className="mb-3 text-lg font-semibold">Feature discovery</h2>
          <form onSubmit={onCreateFeature} className="space-y-2">
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
              placeholder="Feature"
              value={featureForm.title}
              onChange={(e) => setFeatureForm((s) => ({ ...s, title: e.target.value }))}
              required
            />
            <textarea
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
              rows={2}
              placeholder="Detalle"
              value={featureForm.detail}
              onChange={(e) => setFeatureForm((s) => ({ ...s, detail: e.target.value }))}
              required
            />
            <select
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2"
              value={featureForm.status}
              onChange={(e) => setFeatureForm((s) => ({ ...s, status: e.target.value as ProjectFeatureRow["status"] }))}
            >
              <option value="discovered">Discovered</option>
              <option value="ready">Ready</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
            <button className="rounded bg-accent px-3 py-2 font-semibold text-black">Agregar feature</button>
          </form>

          <ul className="mt-3 space-y-2 text-sm">
            {projectFeatures.map((feature) => (
              <li key={feature.id} className="rounded bg-slate-900/70 px-3 py-2">
                <strong>{feature.title}</strong> · {feature.status}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-700 bg-panel p-4 lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Entregables evolutivos por etapa</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.keys(defaultDeliverables).map((item) => (
              <button
                key={item}
                className={`rounded border px-3 py-1 text-sm ${stage === item ? "border-accent text-accent" : "border-slate-700"}`}
                onClick={() => setStage(item as StageKey)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-slate-300">
            {deliverables.map((deliverable) => (
              <li key={deliverable}>{deliverable}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default App;
