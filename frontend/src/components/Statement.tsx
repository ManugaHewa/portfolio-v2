import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";

const LINES = [
  "Every claim on this page is backed by code you can open.",
  "Typed from the database to the browser.",
  "Tests, CI, containers: the boring parts, done anyway.",
];

// Drifts orange to blue across the three lines, rather than sitting on one
// colour - the tint itself tracks scroll the same way the lines do.
const TINTS = ["rgba(255,122,41,0.10)", "rgba(255,255,255,0.05)", "rgba(91,150,255,0.10)"];

function Line({ text, index, progress }: { text: string; index: number; progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const n = LINES.length;
  const start = index / n;
  const end = (index + 1) / n;
  const fade = 0.06;
  const input = [
    Math.max(0, start - fade),
    Math.min(1, start + fade),
    Math.max(0, end - fade),
    Math.min(1, end + fade),
  ];
  const opacity = useTransform(progress, input, [0, 1, 1, 0]);
  const scale = useTransform(progress, input, [0.92, 1, 1, 0.95]);
  const blur = useTransform(progress, input, ["blur(10px)", "blur(0px)", "blur(0px)", "blur(6px)"]);

  return (
    <motion.p className="statement-line" style={{ opacity, scale, filter: blur }}>
      {text}
    </motion.p>
  );
}

export function Statement() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ["start start", "end end"] });
  const tint = useTransform(scrollYProgress, [0, 0.5, 1], TINTS);

  if (reduceMotion) {
    return (
      <section className="statement-static container">
        {LINES.map((text, i) => (
          <Reveal key={text} delay={i * 100}>
            <p className="statement-line statement-line-static">{text}</p>
          </Reveal>
        ))}
      </section>
    );
  }

  return (
    <section className="statement" ref={wrapRef} aria-label="Approach">
      <div className="statement-sticky">
        <motion.div className="statement-tint" style={{ background: tint }} aria-hidden="true" />
        <div className="statement-lines">
          {LINES.map((text, i) => (
            <Line key={text} text={text} index={i} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}
