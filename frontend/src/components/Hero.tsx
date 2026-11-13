import { useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { HeroName, Magnetic, PIN_QUERY, Scramble, TextLoop, useMediaQuery } from "../motion";
import { m, useScroll, useTransform } from "../motion/m";
import { cx } from "../lib/cx";
import { Scene } from "./Scene";
import { WheelMark } from "./WheelMark";
import { RollLabel } from "./RollLabel";
import { SpinPlaque } from "./SpinPlaque";
import { WorkIndex } from "./WorkIndex";
import { SITE } from "../site";
import type { OpenProject, ProjectSummary } from "../types";

interface HeroProps {
  /** Every project, for the deck in the work index. */
  projects: ProjectSummary[];
  /** The list has not arrived yet (development only: production prerenders it). */
  loading?: boolean;
  /** The list failed to load. */
  error?: boolean;
  onOpen: OpenProject;
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

// The stretch of the pin over which the wheel flies into the header:
// it leaves once the work index has covered the copy, and has docked before
// the stage lets go.
const DOCK_FROM = 0.5;
const DOCK_TO = 0.9;

// The live wheel's width as a share of its stage (rouletteScene.ts frames it
// so), and its height as a share of its width: it is seen from above at an
// angle, and the mark it hands over to is drawn face on.
const WHEEL_SPAN = 0.95;
const WHEEL_TILT = 0.9;

/**
 * Where the flying wheel is at `k` (0 at the hero, 1 docked): its centre
 * and size, eased, on an arc that bows up and out rather than a straight
 * diagonal.
 */
export function dockFrame(
  k: number,
  from: { x: number; y: number; size: number },
  to: { x: number; y: number; size: number },
) {
  const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
  const bow = Math.sin(Math.PI * e) * Math.min(160, Math.abs(from.x - to.x) * 0.18);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e - bow,
    size: from.size + (to.size - from.size) * e,
  };
}

// Where the work index's heading has risen to, in px below the header, when
// the copy it rises over has faded out.
const COPY_GONE_AT = 120;

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
export function Hero({ projects, loading, error, onOpen }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const indexHeadRef = useRef<HTMLDivElement>(null);
  const pinned = useMediaQuery(PIN_QUERY);
  const [live, setLive] = useState(false);
  const [keyboardInCopy, setKeyboardInCopy] = useState(false);
  const wheelStageRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: [`start ${HEADER_PX}px`, "end end"],
  });

  // The work index's heading on its way up: 0 as it enters at the bottom of
  // the window, 1 once it is COPY_GONE_AT below the header.
  const { scrollYProgress: indexRise } = useScroll({
    target: indexHeadRef,
    offset: ["start end", `start ${HEADER_PX + COPY_GONE_AT}px`],
  });

  // The copy drifts up and fades as the work index rises over it, timed
  // against the index itself rather than the pin, so what is left of the
  // copy stays until the sheet is about to cover it and no empty band opens
  // between them. The fade starts once the sheet has passed the copy's
  // lower half. The wheel settles back a little across the whole pin, so it
  // keeps reacting until the page moves on.
  const copyY = useTransform(indexRise, [0, 1], [0, -60]);
  const copyOpacity = useTransform(indexRise, [0.45, 1], [1, 0]);
  const wheelScale = useTransform(scrollYProgress, [0, 1], [1, 0.86]);
  // The card table comes in as the wheel leaves for the header (the
  // dock below), into the columns it vacates.
  const deckReveal = useTransform(scrollYProgress, [DOCK_FROM + 0.06, DOCK_FROM + 0.32], [0, 1]);

  /*
   * The dock. Over the second half of the pin the wheel leaves the hero for
   * the mark beside the name in the header (Nav.tsx): the live scene hands
   * over to a fixed SVG copy of itself (WheelMark) where it stands, and the
   * copy flies on an arc and shrinks onto the mark, tilting up to face the
   * page on the way, and the mark then takes over. Scrolling back reverses it. Written straight to the nodes
   * on each scroll change; --dock-mark on <html> tells the header's mark
   * when to show. Only with the pinned layout (so never under reduced
   * motion); everywhere else the header's mark simply shows.
   */
  useEffect(() => {
    const stage = wheelStageRef.current;
    const flight = flightRef.current;
    const root = document.documentElement;
    if (!pinned || !stage || !flight) return;

    const update = (p: number) => {
      const k = Math.min(1, Math.max(0, (p - DOCK_FROM) / (DOCK_TO - DOCK_FROM)));
      const mark = document.querySelector(".brand-mark");
      root.style.setProperty("--dock-mark", k >= 1 ? "1" : "0");
      // The wheel fades out over the first tenth of the flight as its copy
      // fades in on top of it; gone, its Spin plate is out of reach too.
      stage.style.opacity = String(1 - Math.min(1, k / 0.1));
      stage.style.visibility = k >= 0.1 ? "hidden" : "";
      if (k <= 0 || k >= 1 || !mark) {
        flight.style.visibility = "hidden";
        return;
      }
      const a = stage.getBoundingClientRect();
      const b = mark.getBoundingClientRect();
      const f = dockFrame(
        k,
        { x: a.left + a.width / 2, y: a.top + a.height / 2, size: a.width * WHEEL_SPAN },
        { x: b.left + b.width / 2, y: b.top + b.height / 2, size: b.width },
      );
      flight.style.visibility = "visible";
      flight.style.opacity = String(Math.min(1, k / 0.06));
      flight.style.width = flight.style.height = `${f.size}px`;
      flight.style.setProperty("--tilt", String(WHEEL_TILT + (1 - WHEEL_TILT) * Math.min(1, k * 2)));
      flight.style.transform = `translate(${f.x - f.size / 2}px, ${f.y - f.size / 2}px)`;
    };

    update(scrollYProgress.get());
    const stop = scrollYProgress.on("change", update);
    return () => {
      stop();
      root.style.removeProperty("--dock-mark");
      stage.style.opacity = "";
      stage.style.visibility = "";
      flight.style.visibility = "hidden";
    };
  }, [pinned, scrollYProgress]);

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
                interval={3200}
                srLabel="web apps, mobile apps, APIs and machine-learning tools."
              />
            </p>
            {/* The self-hosting claim is about this site only: the Superhero
                API ran on AWS, and an app on a phone runs on no server of
                mine (docs/claims-review.md, N1). */}
            <p className="hero-lede-2 lede">
              Mostly in TypeScript, React, Node.js and Python. I host this site on my own server.
            </p>

            <div className="hero-actions">
              <Magnetic strength={0.25} maxOffset={6}>
                <a className="btn btn-primary" href="#work-index">
                  <RollLabel>See the work</RollLabel>
                </a>
              </Magnetic>
              <a className="btn btn-secondary" href="#contact">
                <RollLabel>Get in touch</RollLabel>
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

          <div className="hero-wheel">
            <m.div
              ref={wheelStageRef}
              className={cx("hero-wheel-stage", live && "is-live")}
              style={pinned ? { scale: wheelScale } : { scale: 1 }}
            >
              {/* The still sits under the live scene and is hidden only while
                  the scene reports a drawn frame. onLive(false) arrives on a
                  lost context and on unmount, and brings it back. */}
              <div className="hero-still" aria-hidden="true" />
              <Scene variant="core" className="scene-core" onLive={setLive} />
              {/* Spin, on the wheel's front rim (SpinPlaque.tsx). */}
              {projects.length > 0 && <SpinPlaque projects={projects} live={live} />}
            </m.div>
          </div>
        </div>
      </div>

      <WorkIndex
        projects={projects}
        loading={loading}
        error={error}
        onOpen={onOpen}
        headRef={indexHeadRef}
        reveal={pinned ? deckReveal : undefined}
      />

      {/* The wheel on its way to the header (see the dock above). */}
      {pinned && (
        <div className="wheel-flight" ref={flightRef} aria-hidden="true">
          <WheelMark />
        </div>
      )}
    </div>
  );
}
