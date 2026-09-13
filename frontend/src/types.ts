export interface ProjectSummary {
  slug: string;
  title: string;
  subtitle: string;
  stack: string[];
  githubUrl: string | null;
  liveUrl: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  problem: string | null;
  scope: string[];
}
