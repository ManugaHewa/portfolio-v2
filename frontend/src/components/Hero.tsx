import { HeroName, Magnetic, Scramble, TextLoop } from "../motion";
import { Scene } from "./Scene";
import { WorkIndex } from "./WorkIndex";
import { SITE } from "../site";
import type { ProjectSummary } from "../types";

interface HeroProps {
  /** The six case studies, in content order, for the work index. */
  cases: ProjectSummary[];
}

// Every item is true of a project on the page: web apps (DMS, Alice, Smart
// Grocery), mobile apps (RxFlow), APIs (the DMS API, the Superhero REST API),
// machine-learning tools (Flaky Test Detector, Sketch2Photo, ShopSense).
const BUILDS = ["web apps", "mobile apps", "APIs", "machine-learning tools"];

/**
 * One container (#top) holding the sticky stage and the work index, which
 * rises over the stage's copy column as the page scrolls (redesign SPEC.md,
 * section 5.2). The pin is CSS (hero.css, under PIN_QUERY); JavaScript only
 * adds the scroll-linked hand-off on top.
 *
 * Stub from the scaffold: the final content and ids, no hand-off yet.
 */
export function Hero({ cases }: HeroProps) {
  return (
    <div className="hero" id="top">
      <div className="hero-stage">
        <div className="hero-copy">
          <p className="hero-place mono">
            <Scramble text="Milton, Ontario · 43.52° N, 79.88° W" trigger="mount" />
          </p>

          <HeroName id="hero-name" text={SITE.name} />

          <p className="hero-lede lede">
            Full-stack developer. I build{" "}
            <TextLoop
              items={BUILDS}
              interval={2600}
              srLabel="web apps, mobile apps, APIs and machine-learning tools."
            />
          </p>
          <p className="hero-lede-2 lede">
            With TypeScript, React, Node.js and Python, hosted on my own server.
          </p>

          <div className="hero-actions">
            <Magnetic strength={0.25} maxOffset={6}>
              <a className="btn btn-primary" href="#work-index">
                See the work
              </a>
            </Magnetic>
            <a className="btn btn-secondary" href="#contact">
              Get in touch
            </a>
          </div>

          <ul className="hero-links">
            <li>
              <a href={SITE.github.url} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <a href={SITE.linkedin.url} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </li>
            <li>
              <a href={`mailto:${SITE.email}`}>Email</a>
            </li>
          </ul>
        </div>

        <div className="hero-gyro" aria-hidden="true">
          <Scene variant="core" className="scene-core" />
        </div>
      </div>

      <WorkIndex cases={cases} />
    </div>
  );
}
