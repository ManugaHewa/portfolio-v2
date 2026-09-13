import { useRef } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * The stylesheet has always painted a radial highlight at var(--mx)/var(--my)
 * on .panel, but nothing ever wrote those variables, so the effect was dead
 * code. This sets them straight on the node during a pointer move rather than
 * through React state: a fast pointer would otherwise queue a re-render per
 * frame for what is only ever a paint change.
 *
 * Deliberately left on under reduced motion. Nothing translates or scales
 * here, it is a colour shift tracking the cursor, which is the same call the
 * rest of the stylesheet makes for opacity and colour.
 */
export function SpotlightPanel({ children, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      className={`panel panel-spotlight${className ? ` ${className}` : ""}`}
      onPointerMove={handleMove}
    >
      {children}
    </div>
  );
}
