export interface ProjectLink {
  label: string;
  url: string;
}

export interface ProjectSummary {
  slug: string;
  title: string;
  subtitle: string;
  stack: string[];
  links: ProjectLink[];
}

/**
 * The full case study. Every list is optional in practice rather than in type:
 * a small project fills in one or two of them and the modal simply skips the
 * sections that come back empty, so a sparse project renders cleanly.
 */
export interface ProjectDetail extends ProjectSummary {
  role: string | null;
  timeline: string | null;
  context: string | null;
  problem: string | null;
  scope: string[];
  stakeholders: string[];
  requirements: string[];
  nonFunctional: string[];
  deliveryProcess: string[];
  risks: string[];
  outcomes: string[];
  highlights: string[];
}
