import { describe, expect, it } from "vitest";
import {
  designProjectPrompt,
  recommendAgentsForProject,
  stacktankRoute,
} from "./stacktank";

describe("stacktankRoute", () => {
  it("always includes product, development, qa", () => {
    const result = stacktankRoute({ text: "build a widget", tags: [], riskLevel: "low" });
    expect(result).toContain("product");
    expect(result).toContain("development");
    expect(result).toContain("qa");
  });

  it("adds legal and devops for high risk", () => {
    const result = stacktankRoute({ text: "simple feature", tags: [], riskLevel: "high" });
    expect(result).toContain("legal");
    expect(result).toContain("devops");
  });

  it("routes legal keyword (Spanish)", () => {
    const result = stacktankRoute({ text: "revisar contrato con proveedor", tags: [], riskLevel: "low" });
    expect(result).toContain("legal");
  });

  it("routes legal keyword (English)", () => {
    const result = stacktankRoute({ text: "review contract with vendor", tags: [], riskLevel: "low" });
    expect(result).toContain("legal");
  });

  it("routes design keyword (Spanish)", () => {
    const result = stacktankRoute({ text: "mejora de diseño de pantallas", tags: [], riskLevel: "low" });
    expect(result).toContain("design");
  });

  it("routes design keyword (English)", () => {
    const result = stacktankRoute({ text: "improve design of screens", tags: [], riskLevel: "low" });
    expect(result).toContain("design");
  });

  it("routes marketing via campaña", () => {
    const result = stacktankRoute({ text: "lanzar campaña de email", tags: [], riskLevel: "low" });
    expect(result).toContain("marketing");
  });

  it("routes marketing via campaign (English)", () => {
    const result = stacktankRoute({ text: "launch email campaign", tags: [], riskLevel: "low" });
    expect(result).toContain("marketing");
  });

  it("returns unique agents only", () => {
    const result = stacktankRoute({ text: "api legal contract compliance", tags: [], riskLevel: "low" });
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
});

describe("recommendAgentsForProject", () => {
  const base = {
    projectName: "TestApp",
    projectScope: "web app",
    objective: "launch MVP",
    constraints: "8 weeks",
    audience: "developers",
    riskLevel: "low" as const,
    discoveryMode: false,
  };

  it("includes product and design when discoveryMode is true", () => {
    const result = recommendAgentsForProject({ ...base, discoveryMode: true });
    expect(result).toContain("product");
    expect(result).toContain("design");
  });

  it("returns unique agents", () => {
    const result = recommendAgentsForProject({ ...base, discoveryMode: true });
    expect(result.length).toBe(new Set(result).size);
  });
});

describe("designProjectPrompt", () => {
  it("includes all project fields", () => {
    const prompt = designProjectPrompt({
      projectName: "MyApp",
      projectScope: "e-commerce",
      objective: "sell products",
      constraints: "budget $10k",
      audience: "consumers",
      riskLevel: "medium",
      discoveryMode: true,
    });
    expect(prompt).toContain("MyApp");
    expect(prompt).toContain("e-commerce");
    expect(prompt).toContain("sell products");
    expect(prompt).toContain("consumers");
    expect(prompt).toContain("medium");
    expect(prompt).toContain("sí");
  });

  it("shows 'no' for discoveryMode false", () => {
    const prompt = designProjectPrompt({
      projectName: "X",
      projectScope: "x",
      objective: "x",
      constraints: "x",
      audience: "x",
      riskLevel: "low",
      discoveryMode: false,
    });
    expect(prompt).toContain("no");
  });
});
