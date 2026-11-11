import { Odometer, SectionHead } from "../motion";
import { Scene } from "./Scene";
import { CATEGORIES, skillsIn } from "../skills";
import { PROJECT_INDEX, projectNumber } from "../stats";

// Evidence written as something other than the project's title.
const ALIASES: Record<string, string> = {
  "Exercise Prescription App": "exercise",
  "This portfolio": "portfolio-v2",
};

function evidenceProject(evidence: string) {
  const slug = ALIASES[evidence];
  return PROJECT_INDEX.find((p) => (slug ? p.slug === slug : p.title === evidence));
}

/**
 * Skills grouped by where they sit in a project, each with the project it was
 * used in (redesign SPEC.md, section 5.6).
 *
 * Stub from the scaffold: the final ids, headings and rows; the skills agent
 * styles them and settles the evidence mapping.
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
          {CATEGORIES.map((c) => {
            const skills = skillsIn(c.id);
            return (
              <div className="skills-group" key={c.id}>
                <h3 className="skills-group-title subsection-title">
                  {c.label} <Odometer value={skills.length} className="skills-count" />
                </h3>
                <ul className="skills-rows">
                  {skills.map((s) => {
                    const project = evidenceProject(s.evidence);
                    return (
                      <li className="skills-row" key={s.name}>
                        <span className="skills-name">{s.name}</span>
                        {project ? (
                          <a
                            className="skills-evidence mono"
                            href={project.tier === 1 ? `#case-${project.slug}` : `#other-${project.slug}`}
                            aria-label={`${s.name}, used in ${project.title}`}
                          >
                            {projectNumber(project.slug)}
                          </a>
                        ) : (
                          <span className="skills-evidence mono">{s.evidence.toLowerCase()}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
