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
  /** The live wheel is drawing (Hero.tsx): it throws the ball and answers. */
  live: boolean;
}

// `count` numbers the landings, so the same number twice is said twice.
type Call =
  | { phase: "idle" }
  | { phase: "spinning"; id: number }
  | { phase: "landed"; number: number; count: number };

/**
 * The plate on the wheel's front rim: Spin, and where the ball landed.
 *
 * Spin asks the live wheel for a throw of its own (lib/spin.ts): the head
 * is pushed, the ball is picked up and thrown again, and the run always ends
 * on a number the deck holds, 1 to the last card, or on the zero. The number
 * is dealt in the deck (lib/dealRequest.ts), so it is the card face up when
 * the visitor reaches the table, and the plate links to it; the zero is the
 * joker, which says get in touch. With no live wheel to throw (reduced
 * motion, "Pause motion", a device without the scene) the plate picks the
 * number itself and simply lands, as every other move does then.
 *
 * In the prerendered page from the start, over the wheel or its still, so
 * nothing moves when the scene arrives; without JavaScript it is hidden
 * (index.html's noscript block), as nothing could answer it. Said once,
 * politely, by the hidden line: the throw, and the number.
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

  // Every landing deals its card, once.
  useEffect(() => {
    if (call.phase !== "landed") return;
    const p = byNumber.get(call.number);
    if (p) requestDeal(p.slug);
  }, [call, byNumber]);

  // The wheel's answer, for the throw still waiting on one.
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

  // The wheel went away mid-throw (its context lost, or the scene switched
  // off): nothing will answer, so the plate does.
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
