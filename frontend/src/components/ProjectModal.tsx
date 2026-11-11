import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
// Not re-exported from ../motion/m, which lists only what the page needed
// before the dialog: a hook, so it cannot trip LazyMotion's strict mode.
import { useIsPresent } from "framer-motion";
import { AnimatePresence, m } from "../motion/m";
import { morphId, useHydrated, useMediaQuery, useMotionAllowed } from "../motion";
import { projectNumber } from "../stats";
import { SCREENSHOTS } from "../screenshots";
import type { ProjectDetail, ProjectLink, ProjectSummary } from "../types";
import { lockScroll, unlockScroll } from "../lib/scrollLock";
import { FADE, MORPH_SPRING, isOngoing } from "./work/workUtils";

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

/** The phone layout, where the dialog is a sheet from the bottom edge. */
const SHEET_QUERY = "(max-width: 719px)";

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
  /** Grow out of the case card (shared layoutId) rather than fade in. */
  morph: boolean;
  /** Motion allowed at all; false means every change lands at once or as a short fade. */
  allowed: boolean;
  sheet: boolean;
  panelRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}

/**
 * The dialog itself, one per opening (keyed by slug under AnimatePresence).
 *
 * The moment its exit starts it goes inert, so a closing dialog cannot be
 * clicked or typed into while it shrinks back into its card or fades. That
 * has to happen in the commit that starts the exit, which is what
 * useIsPresent reports; the parent no longer knows about this layer by then.
 */
function DialogLayer({ project, full, detailError, morph, allowed, sheet, panelRef, onClose }: LayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const present = useIsPresent();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (present) root.removeAttribute("inert");
    else root.setAttribute("inert", "");
  }, [present]);

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

  // The bottom sheet keeps square lower corners. Radii live in style so
  // Motion can correct them while the panel is scaled during the morph.
  const radius = sheet
    ? { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderRadius: 20 };

  // Morphing: the frame grows out of the card and the text, held at its own
  // size, fades in once the frame is most of the way there. Otherwise one
  // short fade (with a small rise when motion is allowed).
  const panelMotion = morph
    ? { transition: { layout: MORPH_SPRING } }
    : {
        initial: { opacity: 0, y: allowed ? 12 : 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: allowed ? 8 : 0 },
        transition: allowed ? { duration: 0.24, ease: FADE.ease } : FADE,
      };

  const contentMotion = morph
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { delay: 0.1, duration: 0.26, ease: FADE.ease } },
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
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          tabIndex={-1}
          layoutId={morph ? morphId(project.slug) : undefined}
          style={radius}
          {...panelMotion}
        >
          <m.div className="dialog-inner" layout={morph ? "position" : undefined} {...contentMotion}>
            <div className="dialog-bar">
              <p className="dialog-readout">
                <span className="dialog-num">{number}</span>
                {shown.category && <span> · {shown.category}</span>}
              </p>
              <button
                type="button"
                className="dialog-close"
                onClick={onClose}
                aria-label="Close project details"
              >
                Close
                <span className="dialog-close-x" aria-hidden="true" />
              </button>
            </div>

            <div className="dialog-body">
              <header className="dialog-head">
                <h2 className="dialog-title" id="dialog-title">
                  {shown.title}
                </h2>
                <p className="dialog-subtitle">{shown.subtitle}</p>

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

                {shown.stack.length > 0 && <p className="dialog-stack">{shown.stack.join(" · ")}</p>}
              </header>

              {shot && (
                <figure className="dialog-shot">
                  <img src={shot.src} alt={shot.alt} width={1600} height={1000} decoding="async" />
                  <figcaption>{shot.caption}</figcaption>
                </figure>
              )}

              <div className="dialog-sections">
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
                    <ListSection title="How it was delivered" items={full.deliveryProcess} />
                    <ListSection title="Technical challenges" items={full.challenges} />
                    <ListSection title="Risks handled" items={full.risks} />
                  </>
                )}
                <ListSection title="Outcomes" items={shown.outcomes} />
                {full && <ListSection title="Next steps" items={full.nextSteps} />}
                {full && <TextSection title="What I learned" text={full.learned} />}

                {shown.links.length > 0 && (
                  <section className="dialog-section">
                    <h3 className="dialog-section-title">Links</h3>
                    <LinkList links={shown.links} />
                  </section>
                )}
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
 * rest when /api/projects/:slug answers. Opened from a case card, it grows
 * out of that card (the card and the panel share a layoutId inside App's
 * LayoutGroup) and shrinks back into it on close. Opened from an Other work
 * row, or with reduced motion or motion paused, it fades.
 *
 * Nothing renders until the page has hydrated: the prerendered HTML has no
 * dialog, and createPortal needs document.body.
 */
export function ProjectModal({ project, detail, detailError = false, onClose, returnFocusTo }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const allowed = useMotionAllowed();
  const sheet = useMediaQuery(SHEET_QUERY);
  // The latest values, read by the effect's cleanup without re-running it.
  const returnRef = useRef(returnFocusTo);
  returnRef.current = returnFocusTo;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const open = project !== null;
  const slug = project?.slug ?? null;

  // Decided once per opening: grow out of the card only when the control that
  // opened the dialog sits inside that project's case card. The layoutId has
  // to be fixed for the panel's whole life, because Motion registers a shared
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
          sheet={sheet}
          panelRef={panelRef}
          onClose={onClose}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
