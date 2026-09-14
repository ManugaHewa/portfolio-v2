import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Statement } from "./components/Statement";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectModal } from "./components/ProjectModal";
import { SkillsSection } from "./components/SkillsSection";
import { ContactSection } from "./components/ContactSection";
import { Reveal } from "./components/Reveal";
import { SectionHead } from "./components/SectionHead";
import { SpotlightPanel } from "./components/SpotlightPanel";
import { CapabilityIcon } from "./components/CapabilityIcon";
import type { CapabilityIconId } from "./components/CapabilityIcon";
import { SmoothScroll } from "./components/SmoothScroll";
import { api } from "./api";
import type { ProjectDetail, ProjectSummary } from "./types";

// One glyph, one short line. The detail behind each of these lives in the
// skills map above and the project case studies below, so repeating it here
// only asks the reader to absorb it twice.
const CAPABILITIES: { icon: CapabilityIconId; title: string; body: string }[] = [
  {
    icon: "layers",
    title: "Full-stack ownership",
    body: "One schema, from database column to rendered pixel.",
  },
  {
    icon: "shield",
    title: "Tested, not just working",
    body: "Proven by machines on both sides of the wire.",
  },
  {
    icon: "ship",
    title: "Shipped, not just coded",
    body: "The pipeline decides when a change is done.",
  },
  {
    icon: "cursor",
    title: "Interfaces with intent",
    body: "Motion tracks scroll. Every effect has an off switch.",
  },
  {
    icon: "database",
    title: "Data modelled on purpose",
    body: "Migrations replayed from scratch, on every push.",
  },
  {
    icon: "lock",
    title: "Security as a default",
    body: "Validated at the edge. Secrets never reach the repo.",
  },
];

const IMPACT = [
  {
    title: "Delivery speed",
    value: "~30% faster",
    note: "Release cycles, via test automation and CI guardrails.",
  },
  {
    title: "Reliability",
    value: "Idempotent import",
    note: "Safe upserts. Re-running a file cannot duplicate records.",
  },
  {
    title: "Real-time UX",
    value: "Live dashboard",
    note: "WebSocket progress while a long import runs.",
  },
];

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getProjects()
      .then(setProjects)
      .catch(() => setLoadError(true))
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    const doc = document.documentElement;
    const onScroll = () => {
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      // Both the bar and the ambient background tint are written straight to
      // the DOM. Holding this in React state re-rendered the whole page tree
      // on every scroll event, which with smooth scrolling means every frame.
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
      doc.style.setProperty("--scroll", String(pct / 100));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openProject = async (slug: string) => {
    try {
      setActiveProject(await api.getProject(slug));
    } catch {
      setLoadError(true);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress-bar" ref={progressRef} />
      </div>

      <Nav />

      <main id="main">
        <Hero />

        <Statement />

        {/* Promoted to the front of the page: the map is the clearest single
            artefact on the site, so it argues the case before the prose does. */}
        <SkillsSection />

        <section className="section container" id="about" aria-labelledby="about-heading">
          <SectionHead
            index="02"
            kicker="What the work looks like"
            title="Six things I bring to a codebase"
            id="about-heading"
            note="Hold me to these in an interview."
          />

          <div className="about-grid">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.title} delay={i * 60}>
                <SpotlightPanel>
                  <span className="capability-glyph" aria-hidden="true">
                    <CapabilityIcon id={c.icon} />
                  </span>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </SpotlightPanel>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="impact-strip">
              <div className="impact-grid">
                {IMPACT.map((item) => (
                  <div className="impact-item" key={item.title}>
                    <div className="impact-title">{item.title}</div>
                    <div className="impact-value">{item.value}</div>
                    <div className="impact-note">{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section className="section container" id="projects" aria-labelledby="projects-heading">
          <SectionHead
            index="03"
            kicker="Evidence"
            title="Featured projects"
            id="projects-heading"
            note="Click a card for the full case study."
          />

          {loadError && (
            <div className="load-error" role="alert">
              <strong>Couldn't reach the API.</strong>
              <span>
                The projects come from Express and Postgres rather than a hardcoded array, so
                this section needs the backend running.
              </span>
            </div>
          )}

          <div className="projects-grid">
            {/* Placeholders rather than an empty grid: the section otherwise
                collapses to its heading and then jumps when the data lands. */}
            {loadingProjects &&
              !loadError &&
              [0, 1, 2].map((i) => (
                <div className="project-skeleton" key={i} aria-hidden="true">
                  <span className="skeleton-line skeleton-title" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line skeleton-short" />
                  <div className="skeleton-chips">
                    {[0, 1, 2, 3].map((c) => (
                      <span className="skeleton-chip" key={c} />
                    ))}
                  </div>
                </div>
              ))}

            {projects.map((p, i) => (
              <Reveal key={p.slug} delay={i * 70}>
                <ProjectCard project={p} onOpen={openProject} />
              </Reveal>
            ))}
          </div>

          {loadingProjects && (
            <p className="visually-hidden" role="status">
              Loading projects
            </p>
          )}
        </section>

        <ContactSection />
      </main>

      <ProjectModal project={activeProject} onClose={() => setActiveProject(null)} />
    </MotionConfig>
  );
}
