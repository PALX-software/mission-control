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
  // legal / compliance
  legal: ["legal", "product"],
  contrato: ["legal"],
  contract: ["legal"],
  compliance: ["legal", "qa"],
  gdpr: ["legal", "data"],
  privacidad: ["legal", "data"],
  privacy: ["legal", "data"],
  // design
  diseño: ["design", "product"],
  design: ["design", "product"],
  ux: ["design"],
  ui: ["design"],
  // marketing
  campaña: ["marketing", "product"],
  campaign: ["marketing", "product"],
  growth: ["marketing"],
  marketing: ["marketing"],
  // development
  api: ["development", "qa"],
  integración: ["development", "devops"],
  integration: ["development", "devops"],
  feature: ["development", "product"],
  // devops / infrastructure
  devops: ["devops"],
  observabilidad: ["devops", "qa"],
  observability: ["devops", "qa"],
  deploy: ["devops"],
  infraestructura: ["devops"],
  infrastructure: ["devops"],
  // data / analytics
  analytics: ["data", "product"],
  datos: ["data"],
  data: ["data"],
  // qa / testing
  testing: ["qa", "development"],
  pruebas: ["qa", "development"],
};

export function stacktankRoute(scope: TaskScope): AgentType[] {
  const seed = new Set<AgentType>(["product", "development", "qa"]);
  const signal = `${scope.text} ${scope.tags.join(" ")}`.toLowerCase();

  for (const [keyword, agents] of Object.entries(byKeyword)) {
    if (signal.includes(keyword)) {
      for (const agent of agents) seed.add(agent);
    }
  }

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
  const routed = new Set(
    stacktankRoute({
      text: `${definition.projectScope} ${definition.objective} ${definition.constraints}`,
      tags: [definition.audience],
      riskLevel: definition.riskLevel,
    }),
  );

  if (definition.discoveryMode) {
    routed.add("product");
    routed.add("design");
  }

  return Array.from(routed);
}
