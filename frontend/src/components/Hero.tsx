import { useEffect, useRef, useState } from "react";
import type { FocusEvent, RefObject } from "react";
import { HEADER_H, HeroName, Magnetic, PIN_QUERY, Scramble, TextLoop, useMediaQuery } from "../motion";
import { m, useScroll, useTransform } from "../motion/m";
import type { MotionValue } from "../motion/m";
import { cx } from "../lib/cx";
import { clamp, easeInOutCubic } from "../lib/math";
import { setWheelHidden } from "../lib/wheelHidden";
import { Scene } from "./Scene";
import { WheelMark } from "./WheelMark";
import { RollLabel } from "./RollLabel";
import { SpinPlaque } from "./SpinPlaque";
import { WorkIndex } from "./WorkIndex";
import { RESUME, SITE } from "../site";
import type { OpenProject, ProjectSummary } from "../types";

interface HeroProps {
  /** Every project, for the deck. */
  projects: ProjectSummary[];
  /** The list has not arrived yet (dev only; production prerenders it). */
  loading?: boolean;
  /** The list failed to load. */
  error?: boolean;
  onOpen: OpenProject;
}

// Each is true of a project on the page: web apps (DMS, Alice, Smart Grocery),
// mobile (RxFlow), APIs (DMS, Superhero), ML (Flaky Test Detector, Sketch2Photo, ShopSense).
const BUILDS = ["web apps", "mobile apps", "APIs", "machine-learning tools"];

// Past this share of the hand-off the copy is fading, so keyboard focus in it scrolls back.
const FOCUS_RETURN_AT = 0.05;

// Share of the pin over which the wheel flies to the header.
const DOCK_FROM = 0.5;
const DOCK_TO = 0.9;

// Live wheel width as a share of its stage (rouletteScene.ts), and its
// height-to-width ratio as seen at an angle (the mark is face on).
const WHEEL_SPAN = 0.95;
const WHEEL_TILT = 0.9;

/** The flying wheel's centre and size at `k` (0 hero, 1 docked), eased along an upward arc. */
export function dockFrame(
  k: number,
  from: { x: number; y: number; size: number },
  to: { x: number; y: number; size: number },
) {
  const e = easeInOutCubic(k);
  const bow = Math.sin(Math.PI * e) * Math.min(160, Math.abs(from.x - to.x) * 0.18);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e - bow,
    size: from.size + (to.size - from.size) * e,
  };
}

// The work index heading's distance below the header when the copy has faded out (px).
const COPY_GONE_AT = 120;

/**
 * #top: the sticky stage plus the work index, which rises over the copy.
 * The pin is CSS (hero.css, same query as PIN_QUERY), so the prerender is
 * laid out right; this adds the scroll-linked hand-off once PIN_QUERY
 * matches, never on the server or while hydrating.
 */
export function Hero({ projects, loading, error, onOpen }: HeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const indexHeadRef = useRef<HTMLDivElement>(null);
  const pinned = useMediaQuery(PIN_QUERY);
  const [keyboardInCopy, setKeyboardInCopy] = useState(false);
  const wheelStageRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: [`start ${HEADER_H}px`, "end end"],
  });

  // Work index heading rising: 0 entering at the bottom, 1 at COPY_GONE_AT below the header.
  const { scrollYProgress: indexRise } = useScroll({
    target: indexHeadRef,
    offset: ["start end", `start ${HEADER_H + COPY_GONE_AT}px`],
  });

  // The copy drifts up and fades, timed to the rising index (not the pin),
  // so no empty band opens between them. The wheel shrinks slightly over the pin.
  const copyY = useTransform(indexRise, [0, 1], [0, -60]);
  const copyOpacity = useTransform(indexRise, [0.45, 1], [1, 0]);
  const wheelScale = useTransform(scrollYProgress, [0, 1], [1, 0.86]);
  // The card table enters as the wheel docks, into the columns it leaves.
  const deckReveal = useTransform(scrollYProgress, [DOCK_FROM + 0.06, DOCK_FROM + 0.32], [0, 1]);

  /*
   * The dock: late in the pin, the live wheel hands over to a fixed SVG copy
   * (WheelMark) that flies on an arc onto the header mark (Nav.tsx), tilting
   * face on; scrolling back reverses it. Written straight to the nodes;
   * --dock-mark on <html> shows the header mark. Pinned layout only, so
   * never under reduced motion.
   */
  useEffect(() => {
    const stage = wheelStageRef.current;
    const flight = flightRef.current;
    const root = document.documentElement;
    if (!pinned || !stage || !flight) return;

    const mark = document.querySelector(".brand-mark");
    const update = (p: number) => {
      const k = clamp((p - DOCK_FROM) / (DOCK_TO - DOCK_FROM), 0, 1);
      // Layout reads before any style writes, so each frame lays out once.
      const flying = k > 0 && k < 1 && mark;
      const a = flying ? stage.getBoundingClientRect() : null;
      const b = flying ? mark.getBoundingClientRect() : null;
      root.style.setProperty("--dock-mark", k >= 1 ? "1" : "0");
      // The wheel fades over the first tenth of the flight; hidden, its Spin plate is unreachable
      // and the scene stops drawing.
      stage.style.opacity = String(1 - Math.min(1, k / 0.1));
      stage.style.visibility = k >= 0.1 ? "hidden" : "";
      setWheelHidden(k >= 0.1);
      if (!a || !b) {
        flight.style.visibility = "hidden";
        return;
      }
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
      setWheelHidden(false);
      root.style.removeProperty("--dock-mark");
      stage.style.opacity = "";
      stage.style.visibility = "";
      flight.style.visibility = "hidden";
    };
  }, [pinned, scrollYProgress]);

  // Keyboard focus in the faded copy (WCAG 2.4.11) scrolls the hero back and
  // holds the copy opaque (hero.css). Clicks don't count, so the copy still fades.
  const onCopyFocus = (e: FocusEvent<HTMLDivElement>) => {
    let keyboard = true;
    try {
      keyboard = e.target.matches(":focus-visible");
    } catch {
      // No :focus-visible support: treat focus as keyboard focus.
    }
    if (!keyboard) return;
    setKeyboardInCopy(true);
    const hero = heroRef.current;
    if (!pinned || !hero || scrollYProgress.get() <= FOCUS_RETURN_AT) return;
    const top = hero.getBoundingClientRect().top + window.scrollY - HEADER_H;
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
            // Keyboard focus in the copy holds it opaque.
            style={pinned ? { y: copyY, opacity: keyboardInCopy ? 1 : copyOpacity } : { y: 0, opacity: 1 }}
            onFocus={onCopyFocus}
            onBlur={onCopyBlur}
          >
            <p className="hero-place mono">
              <Scramble text="Milton, Ontario · 43.52° N, 79.88° W" />
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
            {/* Self-hosting covers this site only (docs/claims-review.md, N1). */}
            <p className="hero-lede-2 lede">
              Mostly in TypeScript, React, Node.js and Python. I host this site on my own server.
            </p>

            <div className="hero-actions">
              <Magnetic>
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
              {RESUME && (
                <li>
                  <a href={RESUME.href}>
                    Résumé<span className="visually-hidden"> (PDF, {RESUME.size})</span>
                  </a>
                </li>
              )}
            </ul>
          </m.div>

          <div className="hero-wheel">
            <WheelStage stageRef={wheelStageRef} scale={pinned ? wheelScale : undefined} projects={projects} />
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

      {/* The wheel in flight to the header (the dock). */}
      {pinned && (
        <div className="wheel-flight" ref={flightRef} aria-hidden="true">
          <WheelMark />
        </div>
      )}
    </div>
  );
}

interface WheelStageProps {
  stageRef: RefObject<HTMLDivElement>;
  scale?: MotionValue<number>;
  projects: ProjectSummary[];
}

/** The wheel, its still and the Spin plate. Owns `live`, so the scene's first frame re-renders only this. */
function WheelStage({ stageRef, scale, projects }: WheelStageProps) {
  const [live, setLive] = useState(false);
  return (
    <m.div ref={stageRef} className={cx("hero-wheel-stage", live && "is-live")} style={{ scale: scale ?? 1 }}>
      {/* The still shows unless the scene has drawn a frame. */}
      <div className="hero-still" aria-hidden="true" />
      <Scene variant="core" className="scene-core" onLive={setLive} />
      {/* Spin, on the wheel's rim (SpinPlaque.tsx). */}
      {projects.length > 0 && <SpinPlaque projects={projects} live={live} />}
    </m.div>
  );
}
