import { Odometer, Reveal, SectionHead } from "../motion";
import { Scene } from "./Scene";
import { CATEGORIES, skillsIn } from "../skills";
import { PROJECT_INDEX, projectNumber } from "../stats";

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
  return (
    <section className="section skills" id="skills" aria-labelledby="skills-heading">
      <Scene variant="globe" className="scene-sticky scene-globe" />
      <div className="container skills-inner">
        <SectionHead
          titleId="skills-heading"
          title="Skills, and where I used them"
          intro="Grouped by where they sit in a project, each with the project I used it in. Numbers are the projects above: 01 to 06 the case studies, 07 to 13 the other work."
        />

        <div className="skills-groups">
          {CATEGORIES.map((c, i) => {
            const skills = skillsIn(c.id);
            const headingId = `skills-group-${c.id}`;
            return (
              <Reveal as="section" className="skills-group" key={c.id} index={i} stagger={0.05} y={16}>
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
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
