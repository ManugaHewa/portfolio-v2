import { Marquee } from "../motion";
import { TECH_BAND } from "../stats";

/**
 * The full-bleed band after the work: every technology the case studies name,
 * once, in the order they first appear (TECH_BAND in stats.ts).
 *
 * Stub from the scaffold: the static list; hero.css styles the band.
 */
export function TechBand() {
  return (
    <div className="tech-band">
      <Marquee items={TECH_BAND} label="Technologies in these case studies" />
    </div>
  );
}
