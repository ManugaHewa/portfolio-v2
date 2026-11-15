import { memo } from "react";
import { Marquee } from "../motion";
import { TECH_BAND } from "../stats";

const LABEL = "Technologies in these case studies";

/**
 * Full-bleed band of every technology the case studies name, in first-seen
 * order (TECH_BAND, stats.ts). Marquee owns the behaviour. The caption
 * repeats the list's name for sighted readers, so it is aria-hidden.
 */
export const TechBand = memo(function TechBand() {
  return (
    <div className="tech-band">
      <p className="tech-band-caption container mono" aria-hidden="true">
        {LABEL}
      </p>
      <Marquee items={TECH_BAND} label={LABEL} />
    </div>
  );
});
