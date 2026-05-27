export type AgentType =
  | "product"
  | "legal"
  | "marketing"
  | "design"
  | "development"
  | "qa"
  | "devops"
  | "data"
  | "custom";

export type TaskScope = {
  text: string;
  tags: string[];
  riskLevel: "low" | "medium" | "high";
};

export type ProjectDefinitionInput = {
  projectName: string;
  projectScope: string;
  objective: string;
  constraints: string;
  audience: string;
  riskLevel: "low" | "medium" | "high";
  discoveryMode: boolean;
};

const byKeyword: Record<string, AgentType[]> = {
  legal: ["legal", "product"],
  contrato: ["legal"],
  compliance: ["legal", "qa"],
  gdpr: ["legal", "data"],
  diseño: ["design", "product"],
  ux: ["design"],
  ui: ["design"],
  campaña: ["marketing", "product"],
  growth: ["marketing"],
  api: ["development", "qa"],
  integración: ["development", "devops"],
  devops: ["devops"],
  observabilidad: ["devops", "qa"],
  analytics: ["data", "product"],
  feature: ["development", "product"],
  testing: ["qa", "development"],
};

export function stacktankRoute(scope: TaskScope): AgentType[] {
  const seed = new Set<AgentType>(["product", "development", "qa"]);
  const signal = `${scope.text} ${scope.tags.join(" ")}`.toLowerCase();

  Object.entries(byKeyword).forEach(([keyword, agents]) => {
    if (signal.includes(keyword)) {
      agents.forEach((agent) => seed.add(agent));
    }
  });

  if (scope.riskLevel === "high") {
    seed.add("legal");
    seed.add("devops");
  }

  return Array.from(seed);
}

export function designProjectPrompt(definition: ProjectDefinitionInput): string {
  return [
    `Proyecto: ${definition.projectName}`,
    `Objetivo de negocio: ${definition.objective}`,
    `Scope funcional inicial: ${definition.projectScope}`,
    `Audiencia objetivo: ${definition.audience}`,
    `Restricciones: ${definition.constraints}`,
    `Riesgo estimado: ${definition.riskLevel}`,
    `Modo discovery activo: ${definition.discoveryMode ? "sí" : "no"}`,
    "Instrucción: propón plan de ejecución por fases, riesgos, dependencias y entregables medibles.",
  ].join("\n");
}

export function recommendAgentsForProject(definition: ProjectDefinitionInput): AgentType[] {
  const routed = stacktankRoute({
    text: `${definition.projectScope} ${definition.objective} ${definition.constraints}`,
    tags: [definition.audience],
    riskLevel: definition.riskLevel,
  });

  if (definition.discoveryMode) {
    routed.push("product", "design");
  }

  return Array.from(new Set(routed));
}
