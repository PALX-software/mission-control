import { supabase } from "../lib/supabase";
import {
  designProjectPrompt,
  recommendAgentsForProject,
  stacktankRoute,
  type ProjectDefinitionInput,
  type TaskScope,
} from "../core/stacktank";

export type { ProjectDefinitionInput };

export type ProjectRow = {
  id: string;
  name: string;
  objective: string;
  scope_definition: string;
  audience: string;
  constraints: string;
  risk_level: "low" | "medium" | "high";
  discovery_mode: boolean;
  github_repo: string;
  prompt_blueprint: string;
};

export type ProjectFeatureRow = {
  id: string;
  project_id: string;
  title: string;
  detail: string;
  status: "discovered" | "ready" | "in_progress" | "done";
};

export type ProjectOutputRow = {
  id: string;
  project_id: string;
  name: string;
  output_type: "doc" | "code" | "qa_report" | "legal_review" | "launch_asset";
  definition: string;
};

const PROJECT_FIELDS =
  "id,name,objective,scope_definition,audience,constraints,risk_level,discovery_mode,github_repo,prompt_blueprint";
const PAGE_SIZE = 50;

export async function fetchProjects() {
  return supabase
    .from("projects")
    .select(PROJECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
}

export async function createProject(definition: Omit<ProjectRow, "id" | "prompt_blueprint">) {
  const prompt_blueprint = designProjectPrompt({
    projectName: definition.name,
    projectScope: definition.scope_definition,
    objective: definition.objective,
    constraints: definition.constraints,
    audience: definition.audience,
    riskLevel: definition.risk_level,
    discoveryMode: definition.discovery_mode,
  });

  const created = await supabase
    .from("projects")
    .insert({ ...definition, prompt_blueprint })
    .select(PROJECT_FIELDS)
    .single();

  if (created.error || !created.data) return created;

  const recommended = recommendAgentsForProject({
    projectName: created.data.name,
    projectScope: created.data.scope_definition,
    objective: created.data.objective,
    constraints: created.data.constraints,
    audience: created.data.audience,
    riskLevel: created.data.risk_level,
    discoveryMode: created.data.discovery_mode,
  });

  await supabase.from("project_agents").insert(
    recommended.map((agent) => ({
      project_id: created.data!.id,
      agent_key: agent,
      assignment_reason: "auto-recommended-by-stacktank",
      mode: "auto",
    })),
  );

  return created;
}

export async function deleteProject(projectId: string) {
  return supabase.from("projects").delete().eq("id", projectId);
}

export function suggestFeatureQuestions(input: ProjectDefinitionInput): string[] {
  const questions = [
    `¿Qué flujo crítico de usuario debe existir en ${input.projectName}?`,
    "¿Qué integración externa (pagos, CRM, ERP, etc.) es obligatoria desde la fase 1?",
    "¿Cuál es el principal riesgo legal/compliance que debemos mitigar antes de salir a producción?",
  ];

  if (input.discoveryMode) {
    questions.push("¿Qué hipótesis quieres validar primero para descubrir nuevos features?");
  }

  return questions;
}

export async function fetchProjectFeatures(projectId: string) {
  return supabase
    .from("project_features")
    .select("id,project_id,title,detail,status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);
}

export async function createProjectFeature(payload: Omit<ProjectFeatureRow, "id">) {
  return supabase
    .from("project_features")
    .insert(payload)
    .select("id,project_id,title,detail,status")
    .single();
}

export async function deleteProjectFeature(featureId: string) {
  return supabase.from("project_features").delete().eq("id", featureId);
}

export async function fetchProjectOutputs(projectId: string) {
  return supabase
    .from("project_outputs")
    .select("id,project_id,name,output_type,definition")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);
}

export async function createProjectOutput(payload: Omit<ProjectOutputRow, "id">) {
  return supabase
    .from("project_outputs")
    .insert(payload)
    .select("id,project_id,name,output_type,definition")
    .single();
}

export async function deleteProjectOutput(outputId: string) {
  return supabase.from("project_outputs").delete().eq("id", outputId);
}

// Initiatives / agents API — available for future UI screens
export async function fetchInitiatives() {
  return supabase
    .from("initiatives")
    .select("id,title,scope_text,stage,risk_level")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
}

export async function createInitiative(payload: {
  title: string;
  scope_text: string;
  stage: "discover" | "plan" | "build" | "validate" | "launch";
  risk_level: "low" | "medium" | "high";
}) {
  const created = await supabase
    .from("initiatives")
    .insert(payload)
    .select("id,title,scope_text,stage,risk_level")
    .single();

  if (created.error || !created.data) return created;

  const taskScope: TaskScope = {
    text: created.data.scope_text,
    tags: [created.data.stage],
    riskLevel: created.data.risk_level,
  };

  await supabase.from("initiative_assignments").insert(
    stacktankRoute(taskScope).map((agent) => ({
      initiative_id: created.data!.id,
      agent_key: agent,
      status: "queued",
    })),
  );

  return created;
}
