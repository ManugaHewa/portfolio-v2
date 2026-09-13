import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Statement } from "./components/Statement";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectModal } from "./components/ProjectModal";
import { SkillsGraph } from "./components/SkillsGraph";
import { ContactForm } from "./components/ContactForm";
import { Reveal } from "./components/Reveal";
import { SmoothScroll } from "./components/SmoothScroll";
import { api } from "./api";
import type { ProjectDetail, ProjectSummary } from "./types";

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    api
      .getProjects()
      .then(setProjects)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const doc = document.documentElement;
    const onScroll = () => {
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      setScrollPct(pct);
      // Drives the ambient background tint (see .bg-scroll-tint) — cheap
      // enough to set every scroll tick without going through React state.
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

      <div className="scroll-progress" aria-hidden="true">
        <div className="scroll-progress-bar" style={{ width: `${scrollPct}%` }} />
      </div>

      <Nav />

      <main id="main">
        <Hero />

        <Statement />

        <section className="section container" id="about">
          <Reveal as="section">
            <h2 className="section-title">What I build</h2>
            <p className="section-subtitle">
              Fewer words, more signal: systems that are reliable, fast, and pleasant to use —
              and that I can defend line by line in an interview.
            </p>
          </Reveal>

          <div className="about-grid">
            <Reveal delay={0}>
              <div className="panel">
                <h3>Full-stack ownership</h3>
                <p>
                  Typed React on the frontend, an Express + Prisma API on the backend, one
                  schema shared end to end — no guesswork at the boundary.
                </p>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="panel">
                <h3>Tested, not just working</h3>
                <p>
                  Vitest + React Testing Library on the frontend, Vitest + Supertest on the
                  backend — behaviour is checked by machines, not just eyeballed.
                </p>
              </div>
            </Reveal>
            <Reveal delay={160}>
              <div className="panel">
                <h3>Shipped, not just coded</h3>
                <p>
                  Docker Compose for local dev, a multi-stage Dockerfile for production, and
                  GitHub Actions running migrations + tests on every push.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div className="impact-strip">
              <div className="impact-grid">
                <div className="impact-item">
                  <div className="impact-title">Architecture</div>
                  <div className="impact-value">Typed end to end</div>
                  <div className="impact-note">
                    Shared TypeScript types between the API and the UI keep the contract honest.
                  </div>
                </div>
                <div className="impact-item">
                  <div className="impact-title">Quality bar</div>
                  <div className="impact-value">CI on every push</div>
                  <div className="impact-note">
                    GitHub Actions spins up a real Postgres service and runs the full test suite.
                  </div>
                </div>
                <div className="impact-item">
                  <div className="impact-title">Delivery</div>
                  <div className="impact-value">Container-first</div>
                  <div className="impact-note">
                    Docker Compose locally, a production Dockerfile for the backend — no
                    "works on my machine" surprises.
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="section skills-section" id="skills">
          <div className="container">
            <Reveal as="section">
              <h2 className="section-title">Skills</h2>
              <p className="section-subtitle">
                Sixteen technologies, one live network — drag it around.
              </p>
            </Reveal>
          </div>

          <Reveal delay={80} className="skills-reveal">
            <SkillsGraph />
          </Reveal>
        </section>

        <section className="section container" id="projects">
          <Reveal as="section">
            <h2 className="section-title">Featured projects</h2>
            <p className="section-subtitle">
              Real APIs, real databases, real tests — click a card for the details.
            </p>
          </Reveal>

          {loadError && (
            <p className="muted" role="alert">
              Couldn't load projects from the API — is the backend running?
            </p>
          )}

          <div className="projects-grid">
            {projects.map((p, i) => (
              <Reveal key={p.slug} delay={i * 70}>
                <ProjectCard project={p} onOpen={openProject} />
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section container" id="contact">
          <Reveal as="section">
            <h2 className="section-title">Contact</h2>
            <p className="section-subtitle">
              Have a role, project, or question in mind? Send a message and I'll reply directly.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <ContactForm />
          </Reveal>
        </section>
      </main>

      <ProjectModal project={activeProject} onClose={() => setActiveProject(null)} />
    </MotionConfig>
  );
}
