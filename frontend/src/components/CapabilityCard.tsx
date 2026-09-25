import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CapabilityIcon } from "./CapabilityIcon";
import type { CapabilityIconId } from "./CapabilityIcon";

export interface Capability {
  icon: CapabilityIconId;
  index: string;
  title: string;
  body: string;
  /** The thing a reader can actually go and look at. */
  proofLabel: string;
  proof: string;
}

/**
 * The section note says "hold me to these in an interview", so each card
 * carries the receipt for its own claim: the file, command or workflow that
 * settles it. The claim is on the face; the proof slides up on hover or
 * focus, which keeps the grid scannable but rewards anyone who stops.
 *
 * The proof is in the DOM at all times rather than being injected on hover,
 * so it is readable by assistive tech and findable with in-page search.
 */
export function CapabilityCard({ capability }: { capability: Capability }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div
      ref={ref}
      className={`panel panel-spotlight capability-card${open ? " is-open" : ""}`}
      tabIndex={0}
      onPointerMove={handleMove}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <div className="capability-head">
        <span className="capability-glyph" aria-hidden="true">
          <CapabilityIcon id={capability.icon} />
        </span>
        <span className="capability-index" aria-hidden="true">
          {capability.index}
        </span>
      </div>

      <h3>{capability.title}</h3>
      <p>{capability.body}</p>

      <p className="capability-proof">
        <span className="capability-proof-label">{capability.proofLabel}</span>
        <strong>{capability.proof}</strong>
      </p>
    </div>
  );
}
