import { useEffect, useMemo, useState } from "react";
import { AuthForm } from "./components/AuthForm";
import { DeliverablesSection, type StageKey } from "./components/DeliverablesSection";
import { FeatureSection } from "./components/FeatureSection";
import { OutputSection } from "./components/OutputSection";
import { ProjectForm } from "./components/ProjectForm";
import { ProjectList } from "./components/ProjectList";
import { PromptSection } from "./components/PromptSection";
import { ToastContainer } from "./components/Toast";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import {
  createProject,
  createProjectFeature,
  createProjectOutput,
  deleteProject,
  deleteProjectFeature,
  deleteProjectOutput,
  fetchProjectFeatures,
  fetchProjectOutputs,
  fetchProjects,
  suggestFeatureQuestions,
  type ProjectFeatureRow,
  type ProjectOutputRow,
  type ProjectRow,
} from "./services/missionControl";

const EMPTY_PROJECT_FORM = {
  name: "",
  objective: "",
  scope_definition: "",
  audience: "",
  constraints: "",
  risk_level: "medium" as ProjectRow["risk_level"],
  discovery_mode: true,
  github_repo: "",
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectFeatures, setProjectFeatures] = useState<ProjectFeatureRow[]>([]);
  const [projectOutputs, setProjectOutputs] = useState<ProjectOutputRow[]>([]);
  const [featureQuestions, setFeatureQuestions] = useState<string[]>([]);
  const [stage, setStage] = useState<StageKey>("discover");
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [projectFormLoading, setProjectFormLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProjectsLoading(true);
    fetchProjects()
      .then((res) => {
        if (res.error) { addToast("Error al cargar proyectos: " + res.error.message, "error"); return; }
        const data = res.data ?? [];
        setProjects(data);
        if (data[0]) setSelectedProjectId(data[0].id);
      })
      .finally(() => setProjectsLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setDetailLoading(true);
    Promise.all([
      fetchProjectFeatures(selectedProjectId),
      fetchProjectOutputs(selectedProjectId),
    ]).then(([featRes, outRes]) => {
      if (featRes.error) addToast("Error al cargar features: " + featRes.error.message, "error");
      else setProjectFeatures(featRes.data ?? []);
      if (outRes.error) addToast("Error al cargar outputs: " + outRes.error.message, "error");
      else setProjectOutputs(outRes.data ?? []);
    }).finally(() => setDetailLoading(false));
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const onCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.github_repo.includes("github.com/")) {
      addToast("La URL del repositorio debe ser de GitHub (https://github.com/…).", "error");
      return;
    }
    setProjectFormLoading(true);
    const res = await createProject(projectForm);
    setProjectFormLoading(false);

    if (res.error || !res.data) {
      addToast("Error al crear proyecto: " + (res.error?.message ?? "sin datos"), "error");
      return;
    }

    const created = res.data as ProjectRow;
    setProjects((prev) => [created, ...prev]);
    setSelectedProjectId(created.id);
    setFeatureQuestions(
      suggestFeatureQuestions({
        projectName: created.name,
        projectScope: created.scope_definition,
        objective: created.objective,
        constraints: created.constraints,
        audience: created.audience,
        riskLevel: created.risk_level,
        discoveryMode: created.discovery_mode,
      }),
    );
    setProjectForm(EMPTY_PROJECT_FORM);
    addToast(`Proyecto "${created.name}" creado.`, "success");
  };

  const onDeleteProject = async (id: string) => {
    const { error } = await deleteProject(id);
    if (error) { addToast("Error al eliminar proyecto: " + error.message, "error"); return; }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (selectedProjectId === id) {
      const next = projects.find((p) => p.id !== id);
      setSelectedProjectId(next?.id ?? "");
      setProjectFeatures([]);
      setProjectOutputs([]);
    }
    addToast("Proyecto eliminado.", "info");
  };

  const onAddFeature = async (form: Pick<ProjectFeatureRow, "title" | "detail" | "status">) => {
    if (!selectedProjectId) return;
    const res = await createProjectFeature({ ...form, project_id: selectedProjectId });
    if (res.error || !res.data) { addToast("Error al agregar feature: " + (res.error?.message ?? ""), "error"); return; }
    setProjectFeatures((prev) => [...prev, res.data as ProjectFeatureRow]);
    addToast("Feature agregado.", "success");
  };

  const onDeleteFeature = async (id: string) => {
    const { error } = await deleteProjectFeature(id);
    if (error) { addToast("Error al eliminar feature: " + error.message, "error"); return; }
    setProjectFeatures((prev) => prev.filter((f) => f.id !== id));
  };

  const onAddOutput = async (form: Pick<ProjectOutputRow, "name" | "output_type" | "definition">) => {
    if (!selectedProjectId) return;
    const res = await createProjectOutput({ ...form, project_id: selectedProjectId });
    if (res.error || !res.data) { addToast("Error al agregar output: " + (res.error?.message ?? ""), "error"); return; }
    setProjectOutputs((prev) => [...prev, res.data as ProjectOutputRow]);
    addToast("Output agregado.", "success");
  };

  const onDeleteOutput = async (id: string) => {
    const { error } = await deleteProjectOutput(id);
    if (error) { addToast("Error al eliminar output: " + error.message, "error"); return; }
    setProjectOutputs((prev) => prev.filter((o) => o.id !== id));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Cargando…
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthForm onError={(msg) => addToast(msg, "error")} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-6 flex items-center justify-between rounded-xl border border-slate-700 bg-panel p-5">
        <div>
          <h1 className="text-2xl font-bold">Mission Control Panel</h1>
          <p className="mt-1 text-sm text-slate-400">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200"
        >
          Cerrar sesión
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProjectForm
          value={projectForm}
          onChange={(update) => setProjectForm((s) => ({ ...s, ...update }))}
          onSubmit={onCreateProject}
          loading={projectFormLoading}
        />

        <ProjectList
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onDelete={onDeleteProject}
          loading={projectsLoading}
        />

        <PromptSection project={selectedProject} featureQuestions={featureQuestions} />

        <OutputSection
          outputs={projectOutputs}
          onAdd={onAddOutput}
          onDelete={onDeleteOutput}
          loading={detailLoading}
        />

        <FeatureSection
          features={projectFeatures}
          onAdd={onAddFeature}
          onDelete={onDeleteFeature}
          loading={detailLoading}
        />

        <DeliverablesSection stage={stage} onStageChange={setStage} />
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
