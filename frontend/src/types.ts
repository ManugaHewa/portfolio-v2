export interface ProjectLink {
  label: string;
  /**
   * Empty when the destination is not known yet. The source list marks those
   * "[add link]", and inventing a URL to fill the gap would be worse than
   * showing the reader that one is coming, so the UI renders an empty url as
   * a muted label rather than as an anchor.
   */
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
  /** The card shows the first one; the modal shows all of them. */
  outcomes: string[];
  links: ProjectLink[];
}

/**
 * The full case study. Every list is optional in practice rather than in type:
 * a small project fills in one or two of them and the modal simply skips the
 * sections that come back empty, so a sparse project renders cleanly.
 */
export interface ProjectDetail extends ProjectSummary {
  context: string | null;
  problem: string | null;
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
