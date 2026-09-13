import { useEffect, useRef } from "react";
import type { ProjectDetail } from "../types";

interface Props {
  project: ProjectDetail | null;
  onClose: () => void;
}

export function ProjectModal({ project, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    cardRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [project, onClose]);

  if (!project) return null;

  return (
    <div className="modal is-open" role="dialog" aria-modal="true" aria-label="Project details">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" ref={cardRef} tabIndex={-1} role="document">
        <button className="modal-close" onClick={onClose} aria-label="Close project details">
          Close
        </button>
        <div className="modal-body">
          <h3>{project.title}</h3>
          <p className="project-meta">{project.subtitle}</p>
          <div className="meta-row">
            {project.stack.map((tag) => (
              <span className="meta-pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          {project.problem && (
            <div className="modal-section">
              <div className="modal-section-title">Problem</div>
              <p>{project.problem}</p>
            </div>
          )}
          {project.scope.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">Scope</div>
              <ul>
                {project.scope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
