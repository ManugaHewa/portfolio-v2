import { useRef, useState } from "react";
import type { FocusEvent } from "react";
import { HeroName, Magnetic, PIN_QUERY, Scramble, TextLoop, useMediaQuery } from "../motion";
import { m, useScroll, useTransform } from "../motion/m";
import { cx } from "../lib/cx";
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

// The sticky header's height. The stage pins just under it, so the hand-off
// is measured from the moment the hero's top meets the header's bottom.
const HEADER_PX = 64;

// Past this much of the hand-off the copy has started to fade under the work
// index, so focus landing in it scrolls the hero back to its start.
const FOCUS_RETURN_AT = 0.05;

/**
 * One container (#top) holding the sticky stage and the work index, which
 * rises over the stage's copy column as the page scrolls (redesign SPEC.md,
 * section 5.2).
 *
 * The pin itself is CSS (hero.css, under the same media query as PIN_QUERY),
 * so the prerendered page is laid out right before any script runs. This
 * component only adds the scroll-linked hand-off on top, and only once
 * useMediaQuery(PIN_QUERY) is true, which is never on the server or during
 * hydration: until then every style below is the resting one.
 */
export function Hero({ cases }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const pinned = useMediaQuery(PIN_QUERY);
  const [live, setLive] = useState(false);
  const [keyboardInCopy, setKeyboardInCopy] = useState(false);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: [`start ${HEADER_PX}px`, "end end"],
  });

  // While the work index rises (the first 45% of the pin) the copy drifts up
  // and fades out under it; the gyroscope settles back a little and its
  // calibration ring turns, across the whole pin, so the instrument keeps
  // reacting until the page moves on.
  const copyY = useTransform(scrollYProgress, [0, 0.45], [0, -60]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);
  const gyroScale = useTransform(scrollYProgress, [0, 1], [1, 0.86]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 40]);

  // A keyboard user tabbing back into the faded copy (WCAG 2.4.11): bring the
  // hero back to its start so nothing focused sits under the work index, and
  // hold the copy at full opacity while focus is in it (hero.css). Only for
  // keyboard focus: a click on "See the work" also focuses that link, and the
  // copy should still fade as the page scrolls away from it.
  const onCopyFocus = (e: FocusEvent<HTMLDivElement>) => {
    let keyboard = true;
    try {
      keyboard = e.target.matches(":focus-visible");
    } catch {
      // A browser without :focus-visible: treat every focus as keyboard focus.
    }
    if (!keyboard) return;
    setKeyboardInCopy(true);
    const hero = heroRef.current;
    if (!pinned || !hero || scrollYProgress.get() <= FOCUS_RETURN_AT) return;
    const top = hero.getBoundingClientRect().top + window.scrollY - HEADER_PX;
    window.scrollTo({ top: Math.max(0, top) });
  };

  const onCopyBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardInCopy(false);
  };

  return (
    <div className="hero" id="top" ref={heroRef}>
      <div className="hero-stage">
        <div className="container hero-grid">
          <m.div
            className={cx("hero-copy", keyboardInCopy && "is-focused")}
            style={pinned ? { y: copyY, opacity: copyOpacity } : { y: 0, opacity: 1 }}
            onFocus={onCopyFocus}
            onBlur={onCopyBlur}
          >
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

            <ul className="hero-links" aria-label="Elsewhere">
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
          </m.div>

          <div className="hero-gyro" aria-hidden="true">
            <m.div
              className={cx("hero-gyro-stage", live && "is-live")}
              style={pinned ? { scale: gyroScale } : { scale: 1 }}
            >
              <m.div className="hero-ring" style={pinned ? { rotate: ringRotate } : { rotate: 0 }}>
                <CalibrationRing />
              </m.div>
              {/* The still sits under the live scene and is hidden only while
                  the scene reports a drawn frame. onLive(false) arrives on a
                  lost context and on unmount, and brings it back. */}
              <div className="hero-still" />
              <Scene variant="core" className="scene-core" onLive={setLive} />
            </m.div>
          </div>
        </div>
      </div>

      <WorkIndex cases={cases} />
    </div>
  );
}

// 72 ticks, one every 5 degrees; every sixth (each 30 degrees) runs longer,
// the way a gimbal's scale marks its major divisions.
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const major = i % 6 === 0;
  const a = (i * 5 * Math.PI) / 180;
  const r1 = 96;
  const r2 = major ? 89 : 92.5;
  const f = (n: number) => Number(n.toFixed(3));
  return {
    key: i,
    major,
    x1: f(100 + r1 * Math.sin(a)),
    y1: f(100 - r1 * Math.cos(a)),
    x2: f(100 + r2 * Math.sin(a)),
    y2: f(100 - r2 * Math.cos(a)),
  };
});

/**
 * The static scale behind the gyroscope: two concentric hairline circles and
 * 72 ticks. Pure SVG, so it is in the HTML and needs no WebGL; the hand-off
 * turns it through 40 degrees.
 */
function CalibrationRing() {
  return (
    <svg className="hero-ring-svg" viewBox="0 0 200 200" focusable="false">
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="86" />
      {TICKS.map((t) => (
        <line
          key={t.key}
          className={t.major ? "is-major" : undefined}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
        />
      ))}
    </svg>
  );
}
