import { useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
// Not re-exported from ../motion/m, which lists only what the page needed
// before the dialog: a hook, so it cannot trip LazyMotion's strict mode.
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
  /** The project being shown, from the list: the dialog opens with this at once. */
  project: ProjectSummary | null;
  /** The full case study, once /api/projects/:slug has answered. */
  detail: ProjectDetail | null;
  /** True when that request failed. */
  detailError?: boolean;
  onClose: () => void;
  /** Where focus goes back to when the dialog closes. */
  returnFocusTo: HTMLElement | null;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Renders a bulleted section, or nothing at all when the list is empty. */
function ListSection({ title, items }: { title: string; items: string[] | null | undefined }) {
  // The API sends [] for an empty list, but a missing one should cost a
  // section, not the whole dialog.
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

/**
 * Links, with the placeholders the source list marks "[add link]" rendered as
 * muted labels rather than anchors: `<a href="">` reloads the page, and
 * inventing a destination would be worse than admitting one is still to come.
 */
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
  /** The full case study, only once it is for this project. */
  full: ProjectDetail | null;
  detailError: boolean;
  /** Grow the figure out of the case card (shared layoutId) rather than fade in. */
  morph: boolean;
  /** Motion allowed at all; false means every change lands at once or as a short fade. */
  allowed: boolean;
  /** Where the open layer reports its panel, for the parent's Tab trap and first focus. */
  panelRef: MutableRefObject<HTMLDivElement | null>;
  onClose: () => void;
}

/**
 * The dialog itself, one per opening (keyed by slug under AnimatePresence).
 *
 * The moment its exit starts it goes inert, so a closing dialog cannot be
 * clicked or typed into while its figure shrinks back into its card or it
 * fades. That has to happen in the commit that starts the exit, which is
 * what useIsPresent reports; the parent no longer knows about this layer by
 * then.
 *
 * A closing layer can still be on screen when the next one opens, so each
 * layer keeps its own panel and its own title id. It hands its panel to the
 * parent only while it is the open one, and on unmount takes it back only if
 * the parent still holds this panel, never the next layer's.
 *
 * The panel itself does not scroll. Its figure sits on top, outside the part
 * that does, so the figure can grow from wherever its card is on the page
 * without being cut off at the panel's edge, and Close stays in reach.
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

  // A placeholder link has a label but no destination yet, so it cannot stand
  // in for a repository: the note below keys off a real url, not off the count.
  const hasPublishedLink = shown.links.some((link) => link.url);

  // Morphing: the figure grows out of the card, the panel's surface opens
  // around it, and the text fades in once the figure is most of the way
  // there. Nothing transforms the panel itself, so the box the figure is
  // measured into is where it really lands. Otherwise the whole panel takes
  // one short fade (with a small rise when motion is allowed).
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

          {/* The card's picture at the head of the dialog: the one thing that
              travels between the two. */}
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
                {/* The plate above already says what the project is. A
                    screenshot does not, so then the line comes down here. */}
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
                {/* A list, so no name breaks across a line, under a label in
                    the same column as the sections below it. */}
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
                {/* The delivery steps lead into the outcomes on one line; with no
                    steps (or before the full case study arrives) the outcomes
                    stand as their own list. */}
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

                {/* The same case study at an address of its own, to share or
                    to keep (scripts/prerender.mjs writes it). */}
                <p className="dialog-permalink">
                  <a href={caseStudyPath(shown.slug)}>Open this case study as a page</a>
                </p>
              </div>

              {/* Several of these have no published repository yet. Saying so
                  beats rendering nothing, which just looks like a link that
                  failed to load. */}
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
 * The case-study dialog (redesign SPEC.md, section 5.3), portalled to <body>
 * outside #app-shell, which App makes inert while this is open (so a screen
 * reader's cursor cannot walk out of the dialog into the page behind).
 *
 * It opens at once with the summary the page already has and fills in the
 * rest when /api/projects/:slug answers. Opened from a case card, the card's
 * figure grows out of the card into the head of the dialog (the two figures
 * share a layoutId inside App's LayoutGroup) and shrinks back into it on
 * close. Opened from an Other work row, or with reduced motion or motion
 * paused, it fades.
 *
 * Nothing renders until the page has hydrated: the prerendered HTML has no
 * dialog, and createPortal needs document.body.
 */
export function ProjectModal({ project, detail, detailError = false, onClose, returnFocusTo }: Props) {
  // The open layer's panel, which that layer sets (see DialogLayer).
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hydrated = useHydrated();
  const allowed = useMotionAllowed();
  // The latest values, read by the effect's cleanup without re-running it.
  const returnRef = useRef(returnFocusTo);
  returnRef.current = returnFocusTo;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const open = project !== null;
  const slug = project?.slug ?? null;

  // Decided once per opening: grow out of the card only when the control that
  // opened the dialog sits inside that project's case card. The layoutId has
  // to be fixed for the figure's whole life, because Motion registers a shared
  // element when it mounts.
  const morph = useMemo(
    () => Boolean(slug && allowed && returnFocusTo?.closest(`[id="${morphId(slug)}"]`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slug, returnFocusTo],
  );

  useEffect(() => {
    if (!open) return;
    lockScroll();
    // Held from the moment the dialog opens: a parent that clears its own
    // record of the trigger in the same update that closes the dialog would
    // otherwise leave nothing to return to.
    const returnTo = returnRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      // Trap: without this, tabbing walks straight out of the dialog and into
      // the page behind it, which is still visible but not meant to be usable.
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
      // App lifts inert from the page in a layout effect, which runs before
      // this, so the element can take focus again by now. preventScroll: the
      // card may still be mid-morph, and the page should not jump to it.
      (returnTo ?? returnRef.current)?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!hydrated) return null;

  // The detail only counts once it is for the project on screen.
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
