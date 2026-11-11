import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "../motion/m";
import { useHydrated } from "../motion";
import type { ProjectDetail, ProjectLink, ProjectSummary } from "../types";
import { lockScroll, unlockScroll } from "../lib/scrollLock";

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
function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="modal-section">
      <h3 className="modal-section-title">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Links, with the placeholders the source list marks "[add link]" rendered as
 * muted labels rather than anchors: `<a href="">` reloads the page, and
 * inventing a destination would be worse than admitting one is still to come.
 */
function LinkList({ links }: { links: ProjectLink[] }) {
  return (
    <div className="project-links">
      {links.map((link) =>
        link.url ? (
          <a className="link" key={link.label} href={link.url} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ) : (
          <span className="link link-pending" key={link.label}>
            {link.label}
            <span className="visually-hidden"> (link not published yet)</span>
          </span>
        ),
      )}
    </div>
  );
}

/**
 * The case-study dialog, portalled to <body> outside #app-shell, which App
 * makes inert while this is open (so a screen reader's cursor cannot walk
 * out of the dialog into the page behind).
 *
 * Adapted by the scaffold to the redesign's props (SPEC.md, section 5.3): it
 * opens with the summary and fills in the detail. The work agent rewrites it
 * with the card morph and the new layout.
 */
export function ProjectModal({ project, detail, detailError = false, onClose, returnFocusTo }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  // The latest values, read by the effect's cleanup without re-running it.
  const returnRef = useRef(returnFocusTo);
  returnRef.current = returnFocusTo;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const open = project !== null;

  useEffect(() => {
    if (!open) return;
    lockScroll();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      // Trap: without this, tabbing walks straight out of the dialog and into
      // the page behind it, which is still visible but not meant to be usable.
      const card = cardRef.current;
      if (!card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    cardRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      // App lifts inert from the page in a layout effect, which runs before
      // this, so the element can take focus again by now.
      returnRef.current?.focus?.();
    };
  }, [open]);

  if (!hydrated) return null;

  // The detail only counts once it is for the project on screen.
  const full = detail && project && detail.slug === project.slug ? detail : null;
  const shown: ProjectSummary | null = full ?? project;

  const facts = shown
    ? [
        { label: "Role", value: shown.role },
        { label: "Timeline", value: shown.timeline },
        { label: "Category", value: shown.category },
        { label: "Status", value: shown.status },
      ].filter((f) => f.value)
    : [];

  // A placeholder link has a label but no destination yet, so it cannot stand
  // in for a repository: the note below keys off a real url, not off the count.
  const hasPublishedLink = shown?.links.some((link) => link.url) ?? false;

  return createPortal(
    <AnimatePresence>
      {shown && (
        <div className="modal is-open" role="dialog" aria-modal="true" aria-labelledby="modal-title" key="modal">
          <m.div
            className="modal-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          />
          <m.div
            className="modal-card"
            ref={cardRef}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <button className="modal-close" onClick={onClose} aria-label="Close project details">
              Close
            </button>
            <div className="modal-body">
              <h2 id="modal-title">{shown.title}</h2>
              <p className="project-meta">{shown.subtitle}</p>

              {facts.length > 0 && (
                <div className="modal-facts">
                  {facts.map((f) => (
                    <div className="modal-fact" key={f.label}>
                      <span className="modal-fact-label">{f.label}</span>
                      <span className="modal-fact-value">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="modal-stack mono">{shown.stack.join(" · ")}</p>

              {!full && !detailError && (
                <p className="modal-loading" role="status">
                  Loading the full case study
                </p>
              )}
              {!full && detailError && (
                <p className="modal-error" role="alert">
                  Couldn&rsquo;t load the full case study. Try again in a moment.
                </p>
              )}

              {full?.context && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Context</h3>
                  <p>{full.context}</p>
                </div>
              )}

              {shown.problem && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Problem</h3>
                  <p>{shown.problem}</p>
                </div>
              )}

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

              {full?.learned && (
                <div className="modal-section">
                  <h3 className="modal-section-title">What I learned</h3>
                  <p>{full.learned}</p>
                </div>
              )}

              {shown.links.length > 0 && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Links</h3>
                  <LinkList links={shown.links} />
                </div>
              )}

              {/* Several of these have no published repository yet. Saying so
                  beats rendering nothing, which just looks like a link that
                  failed to load. */}
              {!hasPublishedLink && (
                <p className="project-no-repo">
                  No public repository linked for this one yet. Happy to walk through the code
                  directly.
                </p>
              )}
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
