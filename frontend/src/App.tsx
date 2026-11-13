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
import type { OpenProject, ProjectDetail, ProjectSummary } from "./types";

interface AppProps {
  /**
   * The project summaries the build-time prerender wrote into the page, so
   * the first render shows the projects instead of skeletons, and matches the
   * HTML React is hydrating. Absent in development, where nothing is
   * prerendered and the list arrives from the API alone.
   */
  initialProjects?: ProjectSummary[];
}

export default function App({ initialProjects }: AppProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects ?? []);
  const [loadError, setLoadError] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(!initialProjects);

  // The dialog: the summary it opened with, the full case study once it
  // arrives, and the control to hand focus back to.
  const [openProject, setOpenProject] = useState<ProjectSummary | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  // The slug of the latest request, so a slow answer for a project that has
  // since been closed or swapped cannot land in the dialog.
  const requested = useRef<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Still asked for with prerendered projects on screen: the data lives in
    // Postgres, and this is the live read. CI checks the API returns exactly
    // what the prerender used, so the swap changes nothing on screen. If the
    // API is down, the prerendered list stays and only the full case studies
    // fail to load.
    api
      .getProjects()
      .then(setProjects)
      .catch(() => {
        if (!initialProjects) setLoadError(true);
      })
      .finally(() => setLoadingProjects(false));
  }, [initialProjects]);

  // Everything but the dialog goes inert while it is open, so neither the
  // keyboard nor a screen reader's own cursor can reach the page behind it.
  // Through the ref because React 18 has no inert prop. A layout effect, so
  // inert is lifted before the dialog's cleanup hands focus back into the page.
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
        {/* Around the page and the dialog both, so the deck's face-up card
            and its dialog can share a layoutId across the portal. */}
        <LayoutGroup>
          <div id="app-shell" ref={shellRef}>
            <a className="skip-link" href="#main">
              Skip to content
            </a>

            <ScrollProgress />
            <Nav />
            {/* Faded out while the hero is pinned, beside the gyroscope's ring. */}
            <IndexRail sections={PAGE_SECTIONS} hideWhilePinned="top" />

            {/* Page-wide, fixed, and purely a backdrop. */}
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
