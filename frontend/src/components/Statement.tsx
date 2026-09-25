import { useRef } from "react";
import type { MotionValue } from "framer-motion";
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";
import { Scene } from "./Scene";

const LINES = [
  "Every claim on this page is backed by code you can open.",
  "Typed from the database to the browser.",
  "Tests, CI, containers: the boring parts, done anyway.",
];

/**
 * The five real artefacts a single field crosses on its way from Postgres to
 * a rendered card. These are files in this repository, not a generic stack
 * diagram: the middle claim is "typed from the database to the browser", and
 * this is that sentence drawn out rather than asserted.
 */
const STAGES = [
  { label: "schema.prisma", sub: "Postgres column" },
  { label: "Prisma Client", sub: "generated type" },
  { label: "routes/projects.ts", sub: "Express handler" },
  { label: "api.ts", sub: "typed fetch client" },
  { label: "ProjectCard.tsx", sub: "rendered pixel" },
];

// The pipeline builds across this slice of the scroll, leaving room at the
// start and end so the section can breathe in and out.
const BUILD_START = 0.08;
const BUILD_END = 0.82;
const SPAN = BUILD_END - BUILD_START;
// Nine steps: five nodes with four connectors threaded between them.
const STEP = SPAN / (STAGES.length * 2 - 1);

function Node({ stage, index, progress }: { stage: (typeof STAGES)[number]; index: number; progress: MotionValue<number> }) {
  const at = BUILD_START + index * 2 * STEP;
  const opacity = useTransform(progress, [at - STEP * 0.6, at + STEP * 0.4], [0.25, 1]);
  const scale = useTransform(progress, [at - STEP * 0.6, at + STEP * 0.4], [0.9, 1]);
  const glow = useTransform(
    progress,
    [at - STEP * 0.6, at + STEP * 0.4],
    ["0 0 0 0 rgba(106,185,231,0)", "0 0 0 1px var(--accent-2-line)"]
  );

  return (
    <motion.li className="pipe-node" style={{ opacity, scale, boxShadow: glow }}>
      <span className="pipe-node-label">{stage.label}</span>
      <span className="pipe-node-sub">{stage.sub}</span>
    </motion.li>
  );
}

function Connector({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const from = BUILD_START + (index * 2 + 1) * STEP;
  const fill = useTransform(progress, [from, from + STEP], [0, 1]);
  // Driven as a custom property rather than scaleX directly: the row runs
  // horizontally on desktop and vertically once it stacks, and the stylesheet
  // picks the axis per breakpoint from the same value.
  return (
    <li className="pipe-link" aria-hidden="true">
      <motion.span className="pipe-link-fill" style={{ ["--fill" as string]: fill }} />
    </li>
  );
}

function Line({ text, index, progress }: { text: string; index: number; progress: MotionValue<number> }) {
  const n = LINES.length;
  const start = index / n;
  const end = (index + 1) / n;
  // A wider crossfade than before. The old 0.06 window snapped between lines;
  // this overlaps them so one hands off to the next.
  const fade = 0.085;
  const input = [
    Math.max(0, start - fade),
    Math.min(1, start + fade),
    Math.max(0, end - fade),
    Math.min(1, end + fade),
  ];
  const opacity = useTransform(progress, input, [0, 1, 1, 0]);
  const y = useTransform(progress, input, [18, 0, 0, -14]);
  const blur = useTransform(progress, input, ["blur(8px)", "blur(0px)", "blur(0px)", "blur(5px)"]);

  return (
    <motion.p className="statement-line" style={{ opacity, y, filter: blur }}>
      {text}
    </motion.p>
  );
}

export function Statement() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });

  // The raw value tracks scroll exactly, which reads as twitchy on a diagram
  // with this many moving parts. A light spring smooths it without
  // introducing the lag of a heavy one.
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.0005,
  });

  // The token that rides the finished line, so the eye has something to
  // follow rather than five things lighting up independently.
  const tokenLeft = useTransform(progress, [BUILD_START, BUILD_END], ["0%", "100%"]);
  // Fades as it reaches the last node rather than parking on top of its
  // label: the value arrives and is absorbed.
  const tokenOpacity = useTransform(
    progress,
    [BUILD_START - 0.04, BUILD_START + 0.03, BUILD_END - 0.12, BUILD_END - 0.04],
    [0, 1, 1, 0]
  );

  if (reduceMotion) {
    return (
      <section className="statement-static container" aria-label="Approach">
        {LINES.map((text, i) => (
          <Reveal key={text} delay={i * 100}>
            <p className="statement-line statement-line-static">{text}</p>
          </Reveal>
        ))}
        <Reveal delay={320}>
          <ol className="pipeline is-static" aria-label="From database column to rendered pixel">
            {STAGES.map((s) => (
              <li className="pipe-node" key={s.label}>
                <span className="pipe-node-label">{s.label}</span>
                <span className="pipe-node-sub">{s.sub}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="statement" ref={wrapRef} aria-label="Approach">
      <div className="statement-sticky">
        <Scene variant="corridor" className="scene-corridor" />
        <div className="statement-inner container">
          <div className="statement-lines">
            {LINES.map((text, i) => (
              <Line key={text} text={text} index={i} progress={progress} />
            ))}
          </div>

          <div className="pipeline-wrap">
            <ol className="pipeline">
              {STAGES.map((stage, i) => (
                <ReactFragmentSafe key={stage.label}>
                  {i > 0 && <Connector index={i - 1} progress={progress} />}
                  <Node stage={stage} index={i} progress={progress} />
                </ReactFragmentSafe>
              ))}
            </ol>

            <div className="pipe-track" aria-hidden="true">
              <motion.span
                className="pipe-token"
                style={{ left: tokenLeft, opacity: tokenOpacity }}
              />
            </div>
          </div>

          {/* The diagram is decorative to assistive tech; this is the claim
              it illustrates, in plain text. */}
          <p className="visually-hidden">
            A typed value travels from {STAGES.map((s) => s.label).join(", then ")}.
          </p>
        </div>
      </div>
    </section>
  );
}

/** <ol> children must be <li>, so the fragment keeps the list valid. */
function ReactFragmentSafe({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
