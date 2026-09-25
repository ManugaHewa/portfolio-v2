import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Nav } from "./components/Nav";
import { Scene } from "./components/Scene";
import { Hero } from "./components/Hero";
import { Statement } from "./components/Statement";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectModal } from "./components/ProjectModal";
import { SkillsSection } from "./components/SkillsSection";
import { ContactSection } from "./components/ContactSection";
import { Reveal } from "./components/Reveal";
import { SectionHead } from "./components/SectionHead";
import { SmoothScroll } from "./components/SmoothScroll";

/**
 * Smaller public repositories that are not projects in their own right. They
 * share the Other work list with the projects that did not earn a card: two
 * kinds of row at one visual weight, since a second heading for two links was
 * more structure than the content justified.
 *
 * Two entries left when the project list took them over: portfolio-v2 is a
 * project of its own now, and AI-Product-Recommendation is the repository
 * behind ShopSense. Listing either twice would read as padding.
 */
const ALSO_ON_GITHUB = [
  {
    name: "Portfolio",
    note: "The previous portfolio, in vanilla HTML, CSS and JavaScript.",
    year: 2025,
    url: "https://github.com/ManugaHewa/Portfolio",
  },
  {
    name: "Calculators",
    note: "Three successive refactors of one Python program.",
    year: 2024,
    url: "https://github.com/ManugaHewa/Calculators",
  },
  // Newest first. Sorted here rather than trusted to the order above, so
  // adding an entry in the wrong place cannot quietly break the sequence.
].sort((a, b) => b.year - a.year);

import { api } from "./api";
import type { ProjectDetail, ProjectSummary } from "./types";

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
    // Measured here rather than inside the scroll handler. scrollHeight forces
    // layout, and with Lenis smoothing the scroll this handler runs every
    // frame, so reading it there meant a forced reflow per frame for a number
    // that only changes when the page itself resizes.
    let max = 0;
    const measure = () => {
      max = doc.scrollHeight - doc.clientHeight;
    };

    // Written straight to the DOM. Holding this in React state re-rendered the
    // whole page tree on every scroll event, which with smooth scrolling means
    // every frame.
    const paint = () => {
      const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
    };

    const remeasure = () => {
      measure();
      paint();
    };

    remeasure();
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", remeasure);
    // The page gets taller when the project data lands and when a modal opens,
    // so the track length has to be remeasured then too, not only on resize.
    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);

    return () => {
      window.removeEventListener("scroll", paint);
      window.removeEventListener("resize", remeasure);
      ro.disconnect();
    };
  }, []);

  // The band a project sits in is a column on the row, not a slice of the
  // ordering, so reordering the seed cannot quietly promote something into the
  // card grid. Both lists keep the order the API sent them in.
  const cards = projects.filter((p) => p.tier === 1);
  const otherWork = projects.filter((p) => p.tier !== 1);

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

      {/* Page-wide, fixed, and purely a backdrop: no sweep crossing the
          content, which is what made the earlier full-page radar intrusive. */}
      <Scene variant="starfield" className="scene-starfield" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress-bar" ref={progressRef} />
      </div>

      <Nav />

      <main id="main">
        <Hero />

        {/* Evidence first. This used to sit fourth, nearly eight viewports
            down, behind a skills map that is by nature self-reported. The
            projects are the only part of the page someone else can verify,
            so they lead. */}
        <section className="section container has-scene" id="projects" aria-labelledby="projects-heading">
          <Scene variant="field" className="scene-field" />
          <SectionHead
            index="01"
            kicker="Evidence"
            title="Selected work"
            id="projects-heading"
            note="Every card opens a full case study."
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

          {/* Placeholders rather than an empty grid: the section otherwise
              collapses to its heading and then jumps when the data lands. */}
          {loadingProjects && !loadError && (
            <div className="projects-grid">
              {[0, 1, 2].map((i) => (
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
            </div>
          )}

          {/* Six cards, three to a row. The ranking is the point: a capstone
              with a real industry client and a coursework routing simulator
              both belong on this page, and giving them the same card would say
              they carry the same weight. */}
          <div className="projects-grid">
            {cards.map((p, i) => (
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

          {/* Everything else in one list: first the projects that did not earn
              a card, then the smaller repositories. A project row opens its
              case study and a repository row links straight out, but they sit
              at one weight because that is what they are worth. Two headings
              for two links was more structure than the content justified. */}
          {(otherWork.length > 0 || ALSO_ON_GITHUB.length > 0) && (
            <Reveal delay={120}>
              <div className="other-work">
                <h3 className="band-title">Other work</h3>
                <div className="projects-compact-list">
                  {otherWork.map((p) => (
                    <ProjectCard
                      key={p.slug}
                      project={p}
                      onOpen={openProject}
                      variant="compact"
                    />
                  ))}

                  {ALSO_ON_GITHUB.map((r) => (
                    <a
                      className="project-compact"
                      key={r.name}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="project-compact-main">
                        <h4 className="project-compact-title">{r.name}</h4>
                        <p className="project-compact-desc">{r.note}</p>
                      </div>
                      <div className="project-compact-aside">
                        <span className="project-category">Repository · {r.year}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </section>

        {/* Sits between the work and the stack sections on purpose: it is the
            claim that the projects above are typed end to end, and it leads
            straight into the map that backs that up. In front of the work it
            was a 2.6-viewport gate before any evidence. */}
        <Statement />

        <SkillsSection />

        <ContactSection />
      </main>

      <ProjectModal project={activeProject} onClose={() => setActiveProject(null)} />
    </MotionConfig>
  );
}
