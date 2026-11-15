import { useEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Odometer, SectionHead, useMotionAllowed, useReplayInView } from "../motion";
import { m } from "../motion/m";
import type { Variants } from "../motion/m";
import { Scene } from "./Scene";
import { hideConstellation, showConstellation } from "../lib/constellation";
import { followDeal } from "../lib/dealRequest";
import { caseStudyPath } from "../lib/paths";
import { CATEGORIES, skillsIn } from "../skills";
import { PROJECT_INDEX, STATS, projectNumber } from "../stats";

// Evidence that names a project other than by its title.
const ALIASES: Record<string, string> = {
  "Exercise Prescription App": "exercise",
  "This portfolio": "portfolio-v2",
  "Donation Management System": "dms",
};

/** The project a skill's evidence names (title or alias), or undefined for non-project evidence. */
export function evidenceProject(evidence: string) {
  const slug = ALIASES[evidence];
  return PROJECT_INDEX.find((p) => (slug ? p.slug === slug : p.title === evidence));
}

// A count padded like projectNumber.
const asNumber = (n: number) => String(n).padStart(2, "0");

/** The numbering note, from the data, so the ranges follow added or re-tiered projects. */
export const NUMBERING =
  STATS.otherProjects > 0
    ? `Numbers are the projects above: 01 to ${asNumber(STATS.caseStudies)} the case studies, ` +
      `${asNumber(STATS.caseStudies + 1)} to ${asNumber(STATS.projects)} the other work.`
    : `Numbers are the projects above, 01 to ${asNumber(STATS.caseStudies)}.`;

/*
 * Group entrance: the columns arrive together when the block comes into
 * view, 50ms apart (watching each group alone left unrevealed holes). Each
 * group keeps data-reveal for the reduced-motion, no-JS and focus rules.
 */
const GROUP_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const GROUP: Variants = {
  hidden: { opacity: 0, y: 16, transition: { duration: 0 } },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: GROUP_EASE, delay: i * 0.05 } }),
};

// Reduced motion or "Pause motion": lands at once.
const GROUP_INSTANT: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0 } },
};

/** The project of the nearest row with data-project, or null. */
export function rowProject(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-project]")?.dataset.project ?? null;
}

/** A skill's project number, clicked: deals that card in the deck (followDeal). */
export function dealFromSkill(e: ReactMouseEvent<HTMLAnchorElement>, slug: string): void {
  followDeal(e, slug);
}

/**
 * Skills grouped by where they sit in a project, each linked to the number
 * of the project it was used in; nothing is rated. Groups flow in CSS
 * columns (skills.css). Hovering a row, or focusing its number, lights
 * every row of that project ([data-hot]); following the number deals its card.
 */
export function Skills() {
  // Also false before hydration, which is fine: the entrance waits for the view.
  const animate = useMotionAllowed();
  const groupsRef = useRef<HTMLDivElement>(null);
  const shown = useReplayInView(groupsRef, 0.1);
  const [hot, setHot] = useState<string | null>(null);
  const point = (e: ReactPointerEvent | FocusEvent) => setHot(rowProject(e.target));
  const clear = () => setHot(null);

  // The starfield draws the lit project as a constellation (lib/constellation.ts).
  useEffect(() => {
    const project = hot ? PROJECT_INDEX.find((p) => p.slug === hot) : undefined;
    if (!project) return;
    showConstellation(project.slug, project.stackSize);
    return () => hideConstellation(project.slug);
  }, [hot]);

  return (
    <section className="section skills" id="skills" aria-labelledby="skills-heading">
      <Scene variant="globe" className="scene-sticky scene-globe" />
      <div className="container skills-inner">
        <SectionHead
          titleId="skills-heading"
          title="Skills, and where I used them"
          intro={`Grouped by where they sit in a project, each with the project I used it in. ${NUMBERING}`}
        />

        <m.div
          ref={groupsRef}
          className="skills-groups"
          initial="hidden"
          animate={shown ? "shown" : "hidden"}
          data-hot={hot ?? undefined}
          onPointerOver={point}
          onPointerLeave={clear}
          onFocus={point}
          onBlur={clear}
        >
          {CATEGORIES.map((c, i) => {
            const skills = skillsIn(c.id);
            const headingId = `skills-group-${c.id}`;
            return (
              <m.section
                className="skills-group"
                key={c.id}
                data-reveal=""
                variants={animate ? GROUP : GROUP_INSTANT}
                custom={i}
              >
                <div className="skills-group-head">
                  <h3 className="skills-group-title subsection-title" id={headingId}>
                    {c.label}
                  </h3>
                  <span className="skills-count">
                    <Odometer value={skills.length} />
                    <span className="visually-hidden"> skills</span>
                  </span>
                </div>
                <ul className="skills-rows" aria-labelledby={headingId}>
                  {skills.map((s) => {
                    const project = evidenceProject(s.evidence);
                    const related = project !== undefined && project.slug === hot;
                    return (
                      <li
                        className={related ? "skills-row is-related" : "skills-row"}
                        key={s.name}
                        data-project={project?.slug}
                      >
                        <span className="skills-name">{s.name}</span>
                        <span className="skills-leader" aria-hidden="true" />
                        {project ? (
                          <a
                            className="skills-evidence skills-number"
                            href={caseStudyPath(project.slug)}
                            onClick={(e) => dealFromSkill(e, project.slug)}
                            aria-label={`${s.name}, used in project ${projectNumber(project.slug)}, ${project.title}`}
                          >
                            {projectNumber(project.slug)}
                          </a>
                        ) : (
                          <span className="skills-evidence skills-note">{s.evidence.toLowerCase()}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </m.section>
            );
          })}
        </m.div>
      </div>
    </section>
  );
}
