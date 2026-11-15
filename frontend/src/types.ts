export interface ProjectLink {
  label: string;
  /** Empty when not published yet; rendered as a muted label, not a link. */
  url: string;
}

/** 1 = a full case-study card, 2 = a row under Other work. */
export type ProjectTier = 1 | 2;

export interface ProjectSummary {
  slug: string;
  title: string;
  subtitle: string;
  stack: string[];
  /** Carried on the summary so a card can answer "what was your part". */
  role: string | null;
  timeline: string | null;
  /** Classification and where the work stands, both shown on the card. */
  category: string | null;
  status: string | null;
  tier: ProjectTier;
  /** Stated beside the case study, before what was built. */
  problem: string | null;
  /** The case study shows the first one; the modal shows all of them. */
  outcomes: string[];
  links: ProjectLink[];
}

/** The full case study. Lists may be empty; the dialog skips empty sections. */
export interface ProjectDetail extends ProjectSummary {
  context: string | null;
  scope: string[];
  stakeholders: string[];
  requirements: string[];
  nonFunctional: string[];
  deliveryProcess: string[];
  risks: string[];
  challenges: string[];
  highlights: string[];
  nextSteps: string[];
  learned: string | null;
}

/** Opens a project's dialog; focus returns to `trigger` on close. */
export type OpenProject = (project: ProjectSummary, trigger: HTMLElement) => void;
