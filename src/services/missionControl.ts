import { supabase } from "../lib/supabase";
import {
  designProjectPrompt,
  recommendAgentsForProject,
  stacktankRoute,
  type ProjectDefinitionInput,
  type TaskScope,
} from "../core/stacktank";

export type AgentRow = {
  id: string;
  name: string;
  role: string;
  automation_level: "auto" | "hybrid" | "manual";
};

export type InitiativeRow = {
  id: string;
  title: string;
  scope_text: string;
  stage: "discover" | "plan" | "build" | "validate" | "launch";
  risk_level: "low" | "medium" | "high";
};

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

export async function fetchAgents() {
  return supabase.from("agents").select("id,name,role,automation_level").order("created_at", { ascending: true });
}

export async function createAgent(payload: Omit<AgentRow, "id">) {
  return supabase.from("agents").insert(payload).select("id,name,role,automation_level").single();
}

export async function fetchInitiatives() {
  return supabase
    .from("initiatives")
    .select("id,title,scope_text,stage,risk_level")
    .order("created_at", { ascending: false });
}

export async function createInitiative(payload: Omit<InitiativeRow, "id">) {
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

  const assignedAgents = stacktankRoute(taskScope);

  await supabase.from("initiative_assignments").insert(
    assignedAgents.map((agent) => ({
      initiative_id: created.data!.id,
      agent_key: agent,
      status: "queued",
    })),
  );

  return created;
}

export async function fetchAssignments(initiativeId: string) {
  return supabase
    .from("initiative_assignments")
    .select("id,agent_key,status")
    .eq("initiative_id", initiativeId)
    .order("created_at", { ascending: true });
}

export async function fetchProjects() {
  return supabase
    .from("projects")
    .select("id,name,objective,scope_definition,audience,constraints,risk_level,discovery_mode,github_repo,prompt_blueprint")
    .order("created_at", { ascending: false });
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
    .select("id,name,objective,scope_definition,audience,constraints,risk_level,discovery_mode,github_repo,prompt_blueprint")
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

export async function suggestFeatureQuestions(input: ProjectDefinitionInput) {
  const baseQuestions = [
    `¿Qué flujo crítico de usuario debe existir en ${input.projectName}?`,
    "¿Qué integración externa (pagos, CRM, ERP, etc.) es obligatoria desde la fase 1?",
    "¿Cuál es el principal riesgo legal/compliance que debemos mitigar antes de salir a producción?",
  ];

  if (input.discoveryMode) {
    baseQuestions.push("¿Qué hipótesis quieres validar primero para descubrir nuevos features?");
  }

  return baseQuestions;
}

export async function fetchProjectFeatures(projectId: string) {
  return supabase
    .from("project_features")
    .select("id,project_id,title,detail,status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
}

export async function createProjectFeature(payload: Omit<ProjectFeatureRow, "id">) {
  return supabase
    .from("project_features")
    .insert(payload)
    .select("id,project_id,title,detail,status")
    .single();
}

export async function fetchProjectOutputs(projectId: string) {
  return supabase
    .from("project_outputs")
    .select("id,project_id,name,output_type,definition")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
}

export async function createProjectOutput(payload: Omit<ProjectOutputRow, "id">) {
  return supabase
    .from("project_outputs")
    .insert(payload)
    .select("id,project_id,name,output_type,definition")
    .single();
}
