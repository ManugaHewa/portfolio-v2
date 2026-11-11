import { Odometer, SectionHead, useMotionAllowed } from "../motion";
import { m } from "../motion/m";
import type { Variants } from "../motion/m";
import { Scene } from "./Scene";
import { CATEGORIES, skillsIn } from "../skills";
import { PROJECT_INDEX, STATS, projectNumber } from "../stats";

// Evidence written as something other than the project's title. The DMS
// entries name the project without the "(DMS)" its title carries.
const ALIASES: Record<string, string> = {
  "Exercise Prescription App": "exercise",
  "This portfolio": "portfolio-v2",
  "Donation Management System": "dms",
};

/**
 * The project a skill's evidence names, or undefined when the evidence is
 * not a project ("Coursework", "Self-directed study" and the like). Matched
 * by title, plus the two aliases above.
 */
export function evidenceProject(evidence: string) {
  const slug = ALIASES[evidence];
  return PROJECT_INDEX.find((p) => (slug ? p.slug === slug : p.title === evidence));
}

// A count as a project number, padded the way projectNumber pads them.
const asNumber = (n: number) => String(n).padStart(2, "0");

/**
 * How the numbers are split, from the data: the case studies come first,
 * then the other work, so the ranges move when a project is added or
 * re-tiered.
 */
export const NUMBERING =
  STATS.otherProjects > 0
    ? `Numbers are the projects above: 01 to ${asNumber(STATS.caseStudies)} the case studies, ` +
      `${asNumber(STATS.caseStudies + 1)} to ${asNumber(STATS.projects)} the other work.`
    : `Numbers are the projects above, 01 to ${asNumber(STATS.caseStudies)}.`;

/*
 * The groups' entrance. The columns arrive as one set, triggered once by the
 * whole block coming into view, each group 50ms after the one before it.
 * Watching each group on its own left a hole: a group starting a little
 * lower than its neighbours could sit unrevealed in the middle column while
 * the groups beside it had shown. Each group still carries data-reveal, so
 * the reduced-motion, no-JavaScript and focus rules show it in place.
 */
const GROUP_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const GROUP: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: GROUP_EASE, delay: i * 0.05 } }),
};

// Reduced motion or "Pause motion": the same entrance, landing at once.
const GROUP_INSTANT: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0 } },
};

/** Where a project sits on the page: its case-study card, or its row under Other work. */
export const projectAnchor = (p: { slug: string; tier: number }) =>
  p.tier === 1 ? `#case-${p.slug}` : `#other-${p.slug}`;

/**
 * Skills grouped by where they sit in a project, each with the project it was
 * used in (redesign SPEC.md, section 5.6).
 *
 * A row is a name and a project number, the same number the project carries
 * in the work above, linked to it; nothing is rated. The groups run in CSS
 * columns (skills.css) so the seven of them pack without a lone straggler,
 * and each arrives with a short stagger; the rows inside them do not move.
 */
export function Skills() {
  // Before hydration this is false as well, which is harmless: the entrance
  // only starts once the block is in view, after hydration.
  const animate = useMotionAllowed();

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
          className="skills-groups"
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, amount: 0.1 }}
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
                    return (
                      <li className="skills-row" key={s.name}>
                        <span className="skills-name">{s.name}</span>
                        <span className="skills-leader" aria-hidden="true" />
                        {project ? (
                          <a
                            className="skills-evidence skills-number"
                            href={projectAnchor(project)}
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
