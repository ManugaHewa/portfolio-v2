import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, LazyMotion, domMax } from "./motion/m";
import { IndexRail, MotionPauseProvider, ScrollProgress, useIsomorphicLayoutEffect } from "./motion";
import { Nav, PAGE_SECTIONS } from "./components/Nav";
import { Scene } from "./components/Scene";
import { Hero } from "./components/Hero";
import { TechBand } from "./components/TechBand";
import { Pipeline } from "./components/Pipeline";
import { Skills } from "./components/Skills";
import { ContactSection } from "./components/ContactSection";
import { Footer } from "./components/Footer";
import { ProjectModal } from "./components/ProjectModal";
import { api } from "./api";
import { useCaseTransition } from "./lib/caseTransition";
import type { OpenProject, ProjectDetail, ProjectSummary } from "./types";

interface AppProps {
  /** Summaries the prerender wrote into the page, so hydration matches. Absent in dev. */
  initialProjects?: ProjectSummary[];
}

export default function App({ initialProjects }: AppProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects ?? []);
  const [loadError, setLoadError] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(!initialProjects);

  // Dialog state: summary, full case study, and the focus return target.
  const [openProject, setOpenProject] = useState<ProjectSummary | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  // Latest requested slug, so a stale answer never lands in the dialog.
  const requested = useRef<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  // Project links morph their card into the page title.
  useCaseTransition();

  useEffect(() => {
    // The live read from Postgres. CI checks it matches the prerendered list;
    // if the API is down, the prerendered list stays.
    api
      .getProjects()
      .then(setProjects)
      .catch(() => {
        if (!initialProjects) setLoadError(true);
      })
      .finally(() => setLoadingProjects(false));
  }, [initialProjects]);

  // The page goes inert while the dialog is open (via ref: React 18 has no
  // inert prop). Layout effect, so it lifts before focus returns.
  const dialogOpen = openProject !== null;
  useIsomorphicLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (dialogOpen) shell.setAttribute("inert", "");
    else shell.removeAttribute("inert");
  }, [dialogOpen]);

  const onOpen = useCallback<OpenProject>((project, trigger) => {
    requested.current = project.slug;
    setReturnFocusTo(trigger);
    setOpenProject(project);
    setDetail(null);
    setDetailError(false);
    api
      .getProject(project.slug)
      .then((full) => {
        if (requested.current === project.slug) setDetail(full);
      })
      .catch(() => {
        if (requested.current === project.slug) setDetailError(true);
      });
  }, []);

  const onClose = useCallback(() => {
    requested.current = null;
    setOpenProject(null);
    setDetail(null);
    setDetailError(false);
  }, []);

  return (
    <LazyMotion features={domMax} strict>
      <MotionPauseProvider>
        {/* Wraps page and dialog, so the card and dialog share a layoutId across the portal. */}
        <LayoutGroup>
          <div id="app-shell" ref={shellRef}>
            <a className="skip-link" href="#main">
              Skip to content
            </a>

            <ScrollProgress />
            <Nav />
            {/* Hidden while the hero pins. */}
            <IndexRail sections={PAGE_SECTIONS} hideWhilePinned="top" />

            {/* Fixed page-wide backdrop. */}
            <Scene variant="starfield" className="scene-starfield" />

            <main id="main">
              <Hero projects={projects} loading={loadingProjects} error={loadError} onOpen={onOpen} />
              <TechBand />
              <Pipeline />
              <Skills />
              <ContactSection />
            </main>

            <Footer />
          </div>

          <ProjectModal
            project={openProject}
            detail={detail}
            detailError={detailError}
            onClose={onClose}
            returnFocusTo={returnFocusTo}
          />
        </LayoutGroup>
      </MotionPauseProvider>
    </LazyMotion>
  );
}
