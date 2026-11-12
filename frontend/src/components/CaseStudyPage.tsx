import type { ProjectContent } from "../../../content/projects";
import { projectNumber } from "../stats";
import { Footer } from "./Footer";
import { LegalHeader } from "./PrivacyPage";
import { caseStudyPath } from "../lib/paths";

interface CaseStudyPageProps {
  project: ProjectContent;
  /** Its neighbours in page order, for the links at the foot. */
  previous?: ProjectContent;
  next?: ProjectContent;
}

const TEXT_SECTIONS: Array<[keyof ProjectContent, string]> = [
  ["context", "Context"],
  ["problem", "Problem"],
];

const LIST_SECTIONS: Array<[keyof ProjectContent, string]> = [
  ["scope", "Scope"],
  ["highlights", "Highlights"],
  ["requirements", "Key requirements"],
  ["nonFunctional", "Non-functional targets"],
  ["deliveryProcess", "How it was delivered"],
  ["challenges", "Technical challenges"],
  ["risks", "Risks handled"],
  ["outcomes", "Outcomes"],
  ["nextSteps", "Next steps"],
];

/**
 * One case study as a page of its own, written at build time (prerender.mjs)
 * and served as plain HTML with no script: the same sections the dialog
 * shows, from the same content, so each project has an address that can be
 * shared and that a search engine can read in full. It borrows the privacy
 * page's stylesheet and header, like the 404.
 */
export function CaseStudyPage({ project: p, previous, next }: CaseStudyPageProps) {
  const facts: Array<[string, string | undefined]> = [
    ["Role", p.role],
    ["Timeline", p.timeline],
    ["Status", p.status],
    ["Category", p.category],
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <LegalHeader />
      <main id="main" className="container legal case-page">
        <h1 className="case-page-title">{p.title}</h1>
        <p className="case-page-index mono">
          <span className={p.tier === 1 ? "pcard-suit is-case" : "pcard-suit is-other"} aria-hidden="true" />
          Project {projectNumber(p.slug)} · {p.tier === 1 ? "Case study" : "Other work"}
        </p>
        <p className="case-page-lede">{p.subtitle}</p>

        <dl className="case-page-facts">
          {facts
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="mono">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>

        {TEXT_SECTIONS.map(([key, title]) =>
          p[key] ? (
            <section className="case-page-section" key={key}>
              <h2>{title}</h2>
              <p>{p[key] as string}</p>
            </section>
          ) : null,
        )}

        {LIST_SECTIONS.map(([key, title]) => {
          const items = p[key] as string[] | undefined;
          if (!items || items.length === 0) return null;
          const List = key === "deliveryProcess" ? "ol" : "ul";
          return (
            <section className="case-page-section" key={key}>
              <h2>{title}</h2>
              <List>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </List>
            </section>
          );
        })}

        {p.learned && (
          <section className="case-page-section">
            <h2>What I learned</h2>
            <p>{p.learned}</p>
          </section>
        )}

        {p.stack.length > 0 && (
          <section className="case-page-section">
            <h2>Stack</h2>
            <ul className="case-page-stack">
              {p.stack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </section>
        )}

        {p.links.length > 0 && (
          <section className="case-page-section">
            <h2>Links</h2>
            <ul>
              {p.links.map((link) => (
                <li key={link.label}>
                  {link.url ? (
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ) : (
                    <>{link.label} (not published yet)</>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="case-page-nav" aria-label="More work">
          {previous && (
            <a href={caseStudyPath(previous.slug)}>
              <span className="mono">Previous</span> {previous.title}
            </a>
          )}
          <a href="/#work-index">
            <span className="mono">Index</span> All the work
          </a>
          {next && (
            <a href={caseStudyPath(next.slug)}>
              <span className="mono">Next</span> {next.title}
            </a>
          )}
        </nav>
      </main>
      <Footer />
    </>
  );
}
