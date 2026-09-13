import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { ProjectSummary } from "../types";

interface Props {
  project: ProjectSummary;
  onOpen: (slug: string) => void;
}

export function ProjectCard({ project, onOpen }: Props) {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 220, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 220, damping: 22 });
  const rotateX = useTransform(springY, [0, 1], [7, -7]);
  const rotateY = useTransform(springX, [0, 1], [-8, 8]);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };
  const handleLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.article
      className="project-card"
      tabIndex={0}
      role="button"
      aria-label={`Open ${project.title} details`}
      onClick={() => onOpen(project.slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(project.slug);
        }
      }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div className="project-content">
        <div className="project-top">
          <h3>{project.title}</h3>
          <p className="project-meta">{project.stack.join(" · ")}</p>
        </div>
        <p className="project-desc">{project.subtitle}</p>
        <div className="project-links">
          {project.githubUrl && (
            <a
              className="link"
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              GitHub →
            </a>
          )}
          {project.liveUrl && (
            <a
              className="link"
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Live demo →
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}
