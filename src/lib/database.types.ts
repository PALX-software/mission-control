export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          role: string;
          automation_level: "auto" | "hybrid" | "manual";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agents"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["agents"]["Insert"]>;
      };
      initiatives: {
        Row: {
          id: string;
          title: string;
          scope_text: string;
          stage: "discover" | "plan" | "build" | "validate" | "launch";
          risk_level: "low" | "medium" | "high";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["initiatives"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["initiatives"]["Insert"]>;
      };
      initiative_assignments: {
        Row: {
          id: string;
          initiative_id: string;
          agent_key: string;
          status: "queued" | "running" | "blocked" | "done";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["initiative_assignments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["initiative_assignments"]["Insert"]>;
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          objective: string;
          scope_definition: string;
          audience: string;
          constraints: string;
          risk_level: "low" | "medium" | "high";
          discovery_mode: boolean;
          github_repo: string;
          prompt_blueprint: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["projects"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      project_agents: {
        Row: {
          id: string;
          project_id: string;
          agent_key: string;
          assignment_reason: string;
          mode: "auto" | "hybrid" | "manual";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["project_agents"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["project_agents"]["Insert"]>;
      };
      project_features: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          detail: string;
          status: "discovered" | "ready" | "in_progress" | "done";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["project_features"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["project_features"]["Insert"]>;
      };
      project_outputs: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          output_type: "doc" | "code" | "qa_report" | "legal_review" | "launch_asset";
          definition: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["project_outputs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["project_outputs"]["Insert"]>;
      };
    };
  };
}
