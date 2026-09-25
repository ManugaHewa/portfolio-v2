import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { ProjectLink, ProjectSummary } from "../types";

/**
 * Two weights of the same card. `compact` is a row rather than a panel: the
 * coursework entries are real and worth linking, but giving them the same
 * visual weight as the capstone would flatten a difference in scope that is
 * the whole point of ranking them.
 */
export type ProjectCardVariant = "featured" | "compact";

interface Props {
  project: ProjectSummary;
  onOpen: (slug: string) => void;
  variant?: ProjectCardVariant;
}

/** How many stack chips a variant shows before the rest collapse to a count. */
const CHIP_LIMIT: Record<ProjectCardVariant, number> = {
  featured: 6,
  compact: 3,
};

/** A status that describes work still moving, which the pill colours apart. */
const ONGOING = /active|progress|live/i;

/**
 * A link with no url yet renders as a muted label rather than an anchor.
 * `<a href="">` reloads the page, and inventing a destination to fill the gap
 * would be worse than either: the reader can see the link is coming.
 */
function ProjectLinks({ links }: { links: ProjectLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="project-links">
      {links.map((link) =>
        link.url ? (
          <a
            className="link"
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
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

function StackChips({ stack, limit }: { stack: string[]; limit: number }) {
  return (
    <ul className="project-stack">
      {stack.slice(0, limit).map((tag) => (
        <li className="stack-chip" key={tag}>
          {tag}
        </li>
      ))}
      {stack.length > limit && (
        <li className="stack-chip stack-chip-more">+{stack.length - limit}</li>
      )}
    </ul>
  );
}

/** Classification and where the work stands, as a pair of small pills. */
function ProjectTags({ project }: { project: ProjectSummary }) {
  if (!project.category && !project.status) return null;
  return (
    <p className="project-tags">
      {project.category && <span className="project-category">{project.category}</span>}
      {project.status && (
        <span className="project-status" data-ongoing={ONGOING.test(project.status)}>
          {project.status}
        </span>
      )}
    </p>
  );
}

export function ProjectCard({ project, onOpen, variant = "featured" }: Props) {
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
  const glare = useMotionTemplate`radial-gradient(340px circle at ${glareX} ${glareY}, rgba(255,255,255,0.13), rgba(233,142,73,0.06) 35%, transparent 65%)`;

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };
  const handleLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  // Every variant opens the same modal the same way, by pointer or by keyboard,
  // so the interaction contract is written once.
  const opens = {
    tabIndex: 0,
    role: "button",
    "aria-label": `Open ${project.title} details`,
    onClick: () => onOpen(project.slug),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen(project.slug);
      }
    },
  } as const;

  // No tilt and no glare on a row: the 3D lift reads as a mistake at this size,
  // and there is no card face for a highlight to travel across.
  if (variant === "compact") {
    return (
      <article className="project-compact" {...opens}>
        <div className="project-compact-main">
          <h4 className="project-compact-title">{project.title}</h4>
          <p className="project-compact-desc">{project.subtitle}</p>
        </div>
        <div className="project-compact-aside">
          {project.category && <span className="project-category">{project.category}</span>}
          <StackChips stack={project.stack} limit={CHIP_LIMIT.compact} />
        </div>
      </article>
    );
  }

  return (
    <motion.article
      className="project-card"
      {...opens}
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
          {project.role && <p className="project-role">{project.role}</p>}
        </div>

        <ProjectTags project={project} />

        <p className="project-desc">{project.subtitle}</p>

        {/* The headline outcome, on the card rather than behind a click. It is
            the single thing a reader is scanning for, and burying it in the
            modal loses most of them before they open it. */}
        {project.outcomes.length > 0 && (
          <p className="project-outcome">
            <span className="project-outcome-label">Outcome</span>
            {project.outcomes[0]}
          </p>
        )}

        {/* The stack reads faster as chips than as a middot-joined sentence,
            and it is the thing people actually scan a project card for. */}
        <StackChips stack={project.stack} limit={CHIP_LIMIT[variant]} />

        <div className="project-foot">
          <span className="project-cta" aria-hidden="true">
            Read the case study
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </span>
          <ProjectLinks links={project.links} />
        </div>
      </div>
    </motion.article>
  );
}
