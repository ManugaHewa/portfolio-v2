import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

interface Props {
  /** Two-digit index, e.g. "01". Editorial numbering across the page. */
  index: string;
  kicker: string;
  title: ReactNode;
  id: string;
  /** One short line, set to the right on wide screens. */
  note?: string;
}

/**
 * One header for every section, so the page has a single rhythm instead of
 * three slightly different arrangements. A hairline rule and a number mark
 * each break, which is what carries the structure now that the prose is short.
 */
export function SectionHead({ index, kicker, title, id, note }: Props) {
  return (
    <Reveal>
      <header className="section-head">
        <div className="section-head-meta">
          <span className="section-index" aria-hidden="true">
            {index}
          </span>
          <span className="section-kicker">{kicker}</span>
        </div>

        <div className="section-head-main">
          <h2 className="section-title" id={id}>
            {title}
          </h2>
          {note && <p className="section-note">{note}</p>}
        </div>
      </header>
    </Reveal>
  );
}
