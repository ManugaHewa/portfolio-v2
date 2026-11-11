import { Marquee } from "../motion";
import { TECH_BAND } from "../stats";

const LABEL = "Technologies in these case studies";

/**
 * The full-bleed band after the work: every technology the case studies name,
 * once, in the order they first appear (TECH_BAND in stats.ts).
 *
 * The Marquee owns the behaviour (the moving row, its pause toggle, the
 * static wrapped list without JavaScript or under reduced motion); hero.css
 * sets the band's type and spacing. The caption repeats the list's own
 * accessible name for sighted readers, so it is hidden from screen readers,
 * which hear the name once, on the list.
 */
export function TechBand() {
  return (
    <div className="tech-band">
      <p className="tech-band-caption container mono" aria-hidden="true">
        {LABEL}
      </p>
      <Marquee items={TECH_BAND} label={LABEL} />
    </div>
  );
}
