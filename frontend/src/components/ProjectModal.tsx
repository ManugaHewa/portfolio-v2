import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ProjectDetail } from "../types";
import { lockScroll, unlockScroll } from "../lib/scrollLock";

interface Props {
  project: ProjectDetail | null;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Renders a bulleted section, or nothing at all when the list is empty. */
function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="modal-section">
      <div className="modal-section-title">{title}</div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectModal({ project, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Whatever had focus when the dialog opened, so it can be handed back.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!project) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    lockScroll();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Trap: without this, tabbing walks straight out of the dialog and into
      // the page behind it, which is still visible but not meant to be usable.
      const card = cardRef.current;
      if (!card) return;
      // No visibility filtering: the dialog never renders hidden subtrees
      // (empty sections are omitted entirely), and the usual offsetParent
      // check misreports inside fixed-position ancestors anyway.
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
      // Send focus back where it came from, so closing does not dump a
      // keyboard user at the top of the document.
      returnFocusRef.current?.focus?.();
    };
  }, [project, onClose]);

  const facts = project
    ? [
        { label: "Role", value: project.role },
        { label: "Timeline", value: project.timeline },
      ].filter((f) => f.value)
    : [];

  return (
    <AnimatePresence>
      {project && (
        <div
          className="modal is-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            className="modal-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            className="modal-card"
            ref={cardRef}
            tabIndex={-1}
            role="document"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <button className="modal-close" onClick={onClose} aria-label="Close project details">
              Close
            </button>
            <div className="modal-body">
              <h3 id="modal-title">{project.title}</h3>
              <p className="project-meta">{project.subtitle}</p>

              <div className="meta-row">
                {project.stack.map((tag) => (
                  <span className="meta-pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>

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

              {project.context && (
                <div className="modal-section">
                  <div className="modal-section-title">Context</div>
                  <p>{project.context}</p>
                </div>
              )}

              {project.problem && (
                <div className="modal-section">
                  <div className="modal-section-title">Problem</div>
                  <p>{project.problem}</p>
                </div>
              )}

              <ListSection title="Scope" items={project.scope} />
              <ListSection title="Highlights" items={project.highlights} />
              <ListSection title="Stakeholders" items={project.stakeholders} />
              <ListSection title="Key requirements" items={project.requirements} />
              <ListSection title="Non-functional targets" items={project.nonFunctional} />
              <ListSection title="How it was delivered" items={project.deliveryProcess} />
              <ListSection title="Risks handled" items={project.risks} />
              <ListSection title="Outcomes" items={project.outcomes} />

              {project.links.length > 0 && (
                <div className="modal-section">
                  <div className="modal-section-title">Links</div>
                  <div className="project-links">
                    {project.links.map((link) => (
                      <a
                        className="link"
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
