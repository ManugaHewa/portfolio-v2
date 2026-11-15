import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { MotionPauseContext } from "../motion/hooks";
import { followDeal, requestDeal } from "../lib/dealRequest";
import { caseStudyPath } from "../lib/paths";
import { pocketInk } from "../lib/roulette";
import { askSpin, onSpinAnswer } from "../lib/spin";
import { projectNumber } from "../stats";
import type { ProjectSummary } from "../types";

interface SpinPlaqueProps {
  projects: ProjectSummary[];
  /** The live wheel is drawing (Hero.tsx), so it throws and answers. */
  live: boolean;
}

// `count` numbers landings, so the same number twice is announced twice.
type Call =
  | { phase: "idle" }
  | { phase: "spinning"; id: number }
  | { phase: "landed"; number: number; count: number };

/**
 * The plate on the wheel's rim: Spin, and where the ball landed.
 *
 * Spin asks the live wheel for a throw (lib/spin.ts) that lands on 0 or a
 * deck number. That card is dealt (lib/dealRequest.ts) and the plate links
 * to it; zero is the joker, linking to contact. Without a live wheel
 * (reduced motion, "Pause motion", no scene) it picks and lands at once.
 * Prerendered; hidden without JS (index.html noscript). A hidden polite
 * line announces the throw and the number.
 */
export function SpinPlaque({ projects, live }: SpinPlaqueProps) {
  const { paused } = useContext(MotionPauseContext);
  const [call, setCall] = useState<Call>({ phase: "idle" });
  const landings = useRef(0);
  const byNumber = useMemo(
    () => new Map(projects.filter((p) => projectNumber(p.slug)).map((p) => [Number(projectNumber(p.slug)), p])),
    [projects],
  );
  const top = Math.max(0, ...byNumber.keys());

  // Each landing deals its card once.
  useEffect(() => {
    if (call.phase !== "landed") return;
    const p = byNumber.get(call.number);
    if (p) requestDeal(p.slug);
  }, [call, byNumber]);

  // The wheel's answer to the pending throw.
  useEffect(
    () =>
      onSpinAnswer((answer) => {
        const count = ++landings.current;
        setCall((now) =>
          now.phase === "spinning" && now.id === answer.id ? { phase: "landed", number: answer.number, count } : now,
        );
      }),
    [],
  );

  // The wheel went away mid-throw (context lost or scene off): the plate answers.
  useEffect(() => {
    if (live) return;
    const number = Math.floor(Math.random() * (top + 1));
    const count = ++landings.current;
    setCall((now) => (now.phase === "spinning" ? { phase: "landed", number, count } : now));
  }, [live, top]);

  const spinning = call.phase === "spinning";
  const spin = () => {
    if (spinning) return;
    if (live && !paused) setCall({ phase: "spinning", id: askSpin(top) });
    else setCall({ phase: "landed", number: Math.floor(Math.random() * (top + 1)), count: ++landings.current });
  };

  const landed = call.phase === "landed" ? call.number : null;
  const project = landed === null ? undefined : byNumber.get(landed);
  const again = call.phase === "landed" && call.count % 2 === 0 ? " " : "";
  const said = spinning
    ? "No more bets."
    : landed === null
      ? ""
      : project
        ? `Landed on ${landed}. ${project.title} is dealt in the work below.${again}`
        : `Landed on 0, the joker.${again}`;

  return (
    <div className={paused ? "spin-plaque is-paused" : "spin-plaque"}>
      <p className="spin-call">
        {landed === null ? (
          <span className="spin-say">{spinning ? "No more bets" : "Place your bets"}</span>
        ) : (
          <>
            <span className={`spin-pocket is-${pocketInk(landed)}`} aria-hidden="true">
              {landed}
            </span>
            {project ? (
              <span className="spin-landed">
                <a
                  className="spin-result"
                  href={caseStudyPath(project.slug)}
                  onClick={(e: ReactMouseEvent<HTMLAnchorElement>) => followDeal(e, project.slug)}
                >
                  {project.title}
                  <span className="visually-hidden">, dealt in the work below</span>
                </a>
                <span className="spin-note" aria-hidden="true">
                  Dealt in the work below
                </span>
              </span>
            ) : (
              <span className="spin-landed">
                <a className="spin-result" href="#contact">
                  Get in touch
                </a>
                <span className="spin-note">The zero is the joker</span>
              </span>
            )}
          </>
        )}
      </p>
      <button type="button" className="spin-button" onClick={spin} aria-disabled={spinning || undefined}>
        <span className="spin-ball" aria-hidden="true" />
        Spin<span className="visually-hidden"> the wheel</span>
      </button>
      <p className="visually-hidden" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
