import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
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

  // A sheen that rides the same springs as the tilt, so the highlight tracks
  // the cursor across the card face instead of sitting in a fixed spot.
  const glareX = useTransform(springX, (v) => `${v * 100}%`);
  const glareY = useTransform(springY, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(340px circle at ${glareX} ${glareY}, rgba(255,255,255,0.13), rgba(240,169,44,0.06) 35%, transparent 65%)`;

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
      <motion.div className="project-glare" style={{ background: glare }} aria-hidden="true" />
      <div className="project-content">
        <div className="project-top">
          <h3>{project.title}</h3>
        </div>
        <p className="project-desc">{project.subtitle}</p>
        {/* The stack reads faster as chips than as a middot-joined sentence,
            and it is the thing people actually scan a project card for. */}
        <ul className="project-stack">
          {project.stack.slice(0, 6).map((tag) => (
            <li className="stack-chip" key={tag}>
              {tag}
            </li>
          ))}
          {project.stack.length > 6 && (
            <li className="stack-chip stack-chip-more">+{project.stack.length - 6}</li>
          )}
        </ul>
        <div className="project-links">
          {project.links.map((link) => (
            <a
              className="link"
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
