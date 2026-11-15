import { useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
// A hook, so importing it directly cannot trip LazyMotion's strict mode.
import { useIsPresent } from "framer-motion";
import { AnimatePresence, m } from "../motion/m";
import { morphId, useHydrated, useMotionAllowed } from "../motion";
import { projectNumber } from "../stats";
import { SCREENSHOTS } from "../screenshots";
import type { ProjectDetail, ProjectLink, ProjectSummary } from "../types";
import { lockScroll, unlockScroll } from "../lib/scrollLock";
import { FigureContents } from "./work/CaseFigure";
import { ProcessTimeline } from "./ProcessTimeline";
import { caseStudyPath } from "../lib/paths";
import { FADE, FIGURE_RADIUS, MORPH_SPRING, figureId, isOngoing } from "./work/workUtils";

interface Props {
  /** The summary from the list; the dialog opens with it at once. */
  project: ProjectSummary | null;
  /** The full case study, once /api/projects/:slug answers. */
  detail: ProjectDetail | null;
  /** That request failed. */
  detailError?: boolean;
  onClose: () => void;
  /** Focus target on close. */
  returnFocusTo: HTMLElement | null;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** A bulleted section, or nothing when the list is empty. */
function ListSection({ title, items }: { title: string; items: string[] | null | undefined }) {
  // Tolerates a missing list as well as [].
  if (!items || items.length === 0) return null;
  return (
    <section className="dialog-section">
      <h3 className="dialog-section-title">{title}</h3>
      <ul className="dialog-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function TextSection({ title, text }: { title: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <section className="dialog-section">
      <h3 className="dialog-section-title">{title}</h3>
      <p>{text}</p>
    </section>
  );
}

/** Links; ones without a url render as muted labels, not anchors. */
function LinkList({ links }: { links: ProjectLink[] }) {
  return (
    <ul className="dialog-links">
      {links.map((link) => (
        <li key={link.label}>
          {link.url ? (
            <a href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ) : (
            <span className="dialog-link-pending">
              {link.label}
              <span className="visually-hidden"> (link not published yet)</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

interface LayerProps {
  project: ProjectSummary;
  /** The full case study, once it is for this project. */
  full: ProjectDetail | null;
  detailError: boolean;
  /** Grow the figure from the face-up card (shared layoutId) instead of fading. */
  morph: boolean;
  /** Motion allowed; false means instant changes or a short fade. */
  allowed: boolean;
  /** Receives the open layer's panel, for the Tab trap and first focus. */
  panelRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
}

/**
 * One dialog per opening (keyed by slug under AnimatePresence). It goes
 * inert as its exit starts (useIsPresent), so a closing dialog takes no
 * input. Layers can overlap, so each keeps its own panel and title id, and
 * hands the panel to the parent only while open. The panel doesn't scroll;
 * the figure sits above the scrolling part so it can grow unclipped.
 */
function DialogLayer({ project, full, detailError, morph, allowed, panelRef, onClose }: LayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ownPanel = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  const titleId = `dialog-title-${useId().replace(/:/g, "")}`;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (present) root.removeAttribute("inert");
    else root.setAttribute("inert", "");
  }, [present]);

  useLayoutEffect(() => {
    if (present) panelRef.current = ownPanel.current;
  }, [present, panelRef]);

  useLayoutEffect(() => {
    const panel = ownPanel.current;
    return () => {
      if (panelRef.current === panel) panelRef.current = null;
    };
  }, [panelRef]);

  const shown: ProjectSummary = full ?? project;
  const number = projectNumber(shown.slug);
  const shot = SCREENSHOTS[shown.slug]?.[0];
  const ongoing = isOngoing(shown.status);

  const facts = [
    { label: "Role", value: shown.role },
    { label: "Timeline", value: shown.timeline },
    { label: "Status", value: shown.status },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  // Placeholder links have no url, so the note below checks for a real one.
  const hasPublishedLink = shown.links.some((link) => link.url);

  // Morph: the figure grows from the card, the surface opens around it and
  // the text fades in; the panel itself never transforms, so the figure
  // lands where measured. Otherwise the panel fades (rising slightly if allowed).
  const panelMotion = morph
    ? {}
    : {
        initial: { opacity: 0, y: allowed ? 12 : 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: allowed ? 8 : 0 },
        transition: allowed ? { duration: 0.24, ease: FADE.ease } : FADE,
      };

  const surfaceMotion = morph
    ? {
        initial: { opacity: 0, scale: 0.97 },
        animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: FADE.ease } },
        exit: { opacity: 0, transition: { duration: 0.2 } },
      }
    : {};

  const contentMotion = morph
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { delay: 0.12, duration: 0.26, ease: FADE.ease } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {};

  return (
    <div className="dialog-root" ref={rootRef}>
      <m.div
        className="dialog-backdrop"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={morph ? { duration: 0.3, ease: FADE.ease } : FADE}
      />
      <div className="dialog-viewport">
        <m.div
          className="dialog-panel"
          ref={ownPanel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          {...panelMotion}
        >
          <m.span className="dialog-surface" aria-hidden="true" {...surfaceMotion} />

          {/* The figure: the one element shared with the card. */}
          <m.div
            className={shot ? "case-figure dialog-figure has-shot" : "case-figure dialog-figure"}
            layoutId={morph ? figureId(project.slug) : undefined}
            style={FIGURE_RADIUS}
            transition={{ layout: MORPH_SPRING }}
          >
            <FigureContents project={shown} shot={shot} eager holdShape={morph} />
          </m.div>

          <m.button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Close project details"
            {...contentMotion}
          >
            Close
            <span className="dialog-close-x" aria-hidden="true" />
          </m.button>

          <m.div className="dialog-scroll" {...contentMotion}>
            <div className="dialog-body">
              <header className="dialog-head">
                <p className="dialog-readout">
                  <span className="dialog-num">{number}</span>
                  {shown.category && <span> · {shown.category}</span>}
                </p>
                <h2 className="dialog-title" id={titleId}>
                  {shown.title}
                </h2>
                {/* The plate shows the subtitle; with a screenshot it goes here. */}
                {shot && <p className="dialog-subtitle">{shown.subtitle}</p>}

                {facts.length > 0 && (
                  <dl className="dialog-facts">
                    {facts.map((f) => (
                      <div className="dialog-fact" key={f.label}>
                        <dt>{f.label}</dt>
                        <dd className={f.label === "Status" ? (ongoing ? "dialog-status is-ongoing" : "dialog-status") : undefined}>
                          {f.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </header>

              {shot && <p className="dialog-caption">{shot.caption}</p>}

              <div className="dialog-sections">
                {/* A list, so no name breaks across lines. */}
                {shown.stack.length > 0 && (
                  <section className="dialog-section">
                    <h3 className="dialog-section-title">Stack</h3>
                    <ul className="dialog-stack">
                      {shown.stack.map((tech) => (
                        <li key={tech}>{tech}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {!full && !detailError && (
                  <div className="dialog-pending">
                    <p className="visually-hidden" role="status">
                      Loading the full case study
                    </p>
                    <div className="dialog-skeleton" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
                {!full && detailError && (
                  <p className="dialog-error" role="alert">
                    Couldn&rsquo;t load the full case study. Try again in a moment.
                  </p>
                )}

                {full && <TextSection title="Context" text={full.context} />}
                <TextSection title="Problem" text={shown.problem} />

                {full && (
                  <>
                    <ListSection title="Scope" items={full.scope} />
                    <ListSection title="Highlights" items={full.highlights} />
                    <ListSection title="Key requirements" items={full.requirements} />
                    <ListSection title="Non-functional targets" items={full.nonFunctional} />
                    <ListSection title="Technical challenges" items={full.challenges} />
                    <ListSection title="Risks handled" items={full.risks} />
                  </>
                )}
                {/* Steps lead into outcomes; without steps, outcomes stand alone. */}
                {full && full.deliveryProcess.length > 0 ? (
                  <ProcessTimeline steps={full.deliveryProcess} outcomes={shown.outcomes} />
                ) : (
                  <ListSection title="Outcomes" items={shown.outcomes} />
                )}
                {full && <ListSection title="Next steps" items={full.nextSteps} />}
                {full && <TextSection title="What I learned" text={full.learned} />}

                {shown.links.length > 0 && (
                  <section className="dialog-section">
                    <h3 className="dialog-section-title">Links</h3>
                    <LinkList links={shown.links} />
                  </section>
                )}

                {/* Its own page (scripts/prerender.mjs). */}
                <p className="dialog-permalink">
                  <a href={caseStudyPath(shown.slug)}>Open this case study as a page</a>
                </p>
              </div>

              {/* Say so when there is no public repository, rather than show nothing. */}
              {!hasPublishedLink && (
                <p className="dialog-note">
                  No public repository linked for this one yet. Happy to walk through the code
                  directly.
                </p>
              )}
            </div>
          </m.div>
        </m.div>
      </div>
    </div>
  );
}

/**
 * The case-study dialog, portalled to <body> outside #app-shell (which App
 * makes inert while open). Opens with the summary, fills in when
 * /api/projects/:slug answers. From the face-up card it morphs (shared
 * layoutId in App's LayoutGroup); otherwise, or without motion, it fades.
 * Renders only after hydration.
 */
export function ProjectModal({ project, detail, detailError = false, onClose, returnFocusTo }: Props) {
  // Set by the open layer (DialogLayer).
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hydrated = useHydrated();
  const allowed = useMotionAllowed();
  // Latest values for the effect cleanup, without re-running it.
  const returnRef = useRef(returnFocusTo);
  returnRef.current = returnFocusTo;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const open = project !== null;
  const slug = project?.slug ?? null;

  // Decided once per opening: morph only when opened from that project's
  // face-up card. Fixed for the figure's life (Motion registers on mount).
  const morph = useMemo(
    () => Boolean(slug && allowed && returnFocusTo?.closest(`[id="${morphId(slug)}"]`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, returnFocusTo],
  );

  useEffect(() => {
    if (!open) return;
    lockScroll();
    // Captured on open, in case the parent clears it while closing.
    const returnTo = returnRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      // Trap Tab inside the dialog.
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const inside = panel.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      // App lifts inert in a layout effect first, so this can take focus.
      // preventScroll: the card may still be morphing.
      (returnTo ?? returnRef.current)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!hydrated) return null;

  // Use the detail only if it matches the project on screen.
  const full = detail && project && detail.slug === project.slug ? detail : null;

  return createPortal(
    <AnimatePresence>
      {project && (
        <DialogLayer
          key={project.slug}
          project={project}
          full={full}
          detailError={detailError}
          morph={morph}
          allowed={allowed}
          panelRef={panelRef}
          onClose={onClose}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
