import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { PIN_QUERY, Scramble, SectionHead, useMediaQuery } from "../motion";
import { m, useMotionValue, useScroll, useSpring, useTransform } from "../motion/m";
import type { MotionValue } from "../motion/m";
import { Scene } from "./Scene";
import { LiveReadout } from "./LiveReadout";
import { CodePeek } from "./CodePeek";
import { CommitStrip } from "./CommitStrip";
import { PEEKS } from "virtual:code-peeks";
import { projectNumber } from "../stats";

/**
 * How the project list reaches the page (redesign SPEC.md, section 5.5).
 *
 * Every node is a claim about this repository, so each one carries the path
 * of the file that makes it true. pipeline.test.tsx checks that every cited
 * path exists and still says what the node claims, so the diagram cannot
 * quietly drift away from the code it describes.
 */
export interface PipelineStep {
  /** The file, table or endpoint, as it is named in the code. */
  label: string;
  text: string;
  /** Repository-relative path of the file that makes the step true. */
  source: string;
}

export const PIPELINE_NODES: PipelineStep[] = [
  { label: "content/projects.ts", text: "Every project, written once.", source: "content/projects.ts" },
  {
    label: "backend/prisma/seed.ts",
    text: "Copies it into Postgres on every deploy.",
    source: "scripts/deploy.sh",
  },
  { label: "PostgreSQL", text: "The Project and ProjectLink tables.", source: "backend/prisma/schema.prisma" },
  {
    label: "GET /api/projects",
    text: "Express and Prisma serve the list.",
    source: "backend/src/routes/projects.ts",
  },
  { label: "This page", text: "Fetches the list once it has loaded.", source: "frontend/src/App.tsx" },
];

/** The second route, from the first node straight to the last. */
export const PRERENDER_ROUTE: PipelineStep = {
  label: "frontend/scripts/prerender.mjs",
  text: "Writes the same list into the HTML at build time.",
  source: "frontend/scripts/prerender.mjs",
};

/** The check on the join, where the two routes meet. */
export const CI_CHECK = {
  text: "A CI test checks the API returns exactly the list the HTML was built from.",
  source: "backend/src/__tests__/content.integration.test.ts",
};

/*
 * The scroll timeline, as fractions of the pinned stretch. The first node
 * lights as soon as the stage pins; the rail then carries the token through
 * the other four; the prerender route draws in once the first route has
 * arrived, and the CI check lands last, with a little scroll left over so the
 * finished diagram holds still before the stage lets go.
 */
const FIRST_NODE_AT = 0.03;
const RAIL: [number, number] = [0.06, 0.64];
const ROUTE: [number, number] = [0.7, 0.84];
const CI_AT = 0.9;

// The gap between two columns of the pinned row, as a share of one column's
// width: about what pipeline.css's --g comes to. Only the first guess at the
// stations below uses it; measurement replaces that guess.
const GAP_SHARE = 0.25;

/**
 * Where the drawing stands: how many nodes are lit, and whether the second
 * route and the CI check are showing. null is the finished diagram, which is
 * what the server renders and what every visitor outside the pinned layout
 * keeps (reduced motion, short or narrow screens, no JavaScript).
 */
interface Stage {
  lit: number;
  route: boolean;
  ci: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Lets a long path break after a slash rather than mid-name, if it must. */
const breakable = (s: string) => s.replace(/(\S)\//g, "$1/​");

/**
 * A path that can break after a slash and nowhere else: each piece, slash
 * included, is kept whole, with a <wbr> between pieces.
 */
function PathText({ path }: { path: string }) {
  const pieces = path.split("/").map((piece, i, all) => (i < all.length - 1 ? `${piece}/` : piece));
  return (
    <>
      {pieces.map((piece, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          <span className="pl-path-piece">{piece}</span>
        </Fragment>
      ))}
    </>
  );
}

/**
 * Where each node starts along the rail, which runs from the first node's
 * right edge to the last node's left edge: 0 is the first, 1 the last. Five
 * equal columns put the stations evenly; this first guess assumes the gap is
 * GAP_SHARE of a column and is replaced by measurement as soon as the
 * diagram is on screen.
 */
function estimatedStations(): number[] {
  const n = PIPELINE_NODES.length;
  const pitch = 1 + GAP_SHARE;
  const length = (n - 1) * pitch - 1;
  return PIPELINE_NODES.map((_, i) => (i === 0 ? 0 : (i * pitch - 1) / length));
}

function stageAt(progress: number, stations: number[]): Stage {
  const fill = clamp01((progress - RAIL[0]) / (RAIL[1] - RAIL[0]));
  let lit = progress >= FIRST_NODE_AT ? 1 : 0;
  // A small tolerance, so the last station lights when the rail is full even
  // if a measured position lands a hair past 1.
  if (lit) lit += stations.slice(1).filter((s) => fill >= s - 0.004).length;
  return { lit, route: progress >= ROUTE[0], ci: progress >= CI_AT };
}

const sameStage = (a: Stage | null, b: Stage | null) =>
  a === b || (!!a && !!b && a.lit === b.lit && a.route === b.route && a.ci === b.ci);

export function Pipeline() {
  const trackRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<SVGSVGElement>(null);
  const stations = useRef<number[]>(estimatedStations());
  const pinned = useMediaQuery(PIN_QUERY);
  const [stage, setStage] = useState<Stage | null>(null);
  const [routeBox, setRouteBox] = useState<{ w: number; h: number } | null>(null);

  // The pinned stretch runs from the moment the stage sticks under the
  // header to the moment the track's end reaches the bottom of the screen.
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start 64px", "end end"] });
  // A light spring takes the steps out of wheel scrolling without making the
  // drawing feel like it lags behind the scroll.
  const progress = useSpring(scrollYProgress, { stiffness: 260, damping: 34, restDelta: 0.0005 });
  const railFill = useTransform(progress, RAIL, [0, 1]);
  const routeDraw = useTransform(progress, ROUTE, [0, 1]);
  const tokenShift = useTransform(railFill, (f) => `${(f - 1) * 100}%`);
  const tokenOpacity = useTransform(progress, [0.02, 0.05], [0, 1]);
  const done = useMotionValue(1);
  const doneShift = useMotionValue("0%");

  // Only the pinned layout is scrubbed. Everywhere else the drawing stays
  // finished, and the CSS lays it out as a list.
  const driven = pinned;

  useEffect(() => {
    if (!driven) {
      setStage(null);
      return;
    }
    const update = (v: number) => {
      const next = stageAt(v, stations.current);
      setStage((prev) => (sameStage(prev, next) ? prev : next));
    };
    update(progress.get());
    return progress.on("change", update);
  }, [driven, progress]);

  // Measure where each node really starts along the rail, and the box the
  // second route is drawn in, whenever the diagram changes size.
  useEffect(() => {
    const nodes = nodesRef.current;
    if (!nodes || typeof ResizeObserver !== "function") return;
    const measure = () => {
      const boxes = Array.from(nodes.querySelectorAll<HTMLElement>(".pl-node"));
      const rail = nodes.querySelector<HTMLElement>(".pl-rail");
      const r = rail?.getBoundingClientRect();
      if (r && r.width > 0 && boxes.length === PIPELINE_NODES.length) {
        stations.current = boxes.map((b, i) =>
          i === 0 ? 0 : clamp01((b.getBoundingClientRect().left - r.left) / r.width),
        );
      }
      const svg = routeRef.current?.getBoundingClientRect();
      setRouteBox(svg && svg.width > 0 && svg.height > 0 ? { w: svg.width, h: svg.height } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nodes);
    return () => ro.disconnect();
  }, [pinned]);

  /*
   * The code behind each step (CodePeek, built from the repository at build
   * time). Each node is a button: focus or a click opens its excerpt, and on
   * the pinned layout so does pointing at it; a click holds it open until
   * the visitor moves on, Escape or a second click closes it. The excerpt
   * opens above the row on the pinned layout and under its node in the list.
   */
  const [peek, setPeek] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  const closePeek = () => {
    setPeek(null);
    setHeld(false);
  };

  const lit = (i: number) => stage === null || i < stage.lit;
  // Labels decode only on the way through the pinned drawing, the first time
  // their node lights. In the finished state they are simply there.
  const decoding = (i: number) => stage !== null && i < stage.lit;
  const routeOn = stage === null || stage.route;
  const ciOn = stage === null || stage.ci;
  // The step counter in the head: which node the drawing has reached. It
  // reads 1 from the moment the stage pins, and the finished diagram is 5/5.
  const step = stage === null ? PIPELINE_NODES.length : Math.max(1, stage.lit);

  return (
    <section className="section pipeline" id="pipeline" aria-labelledby="pipeline-heading">
      <div className="pipeline-track" ref={trackRef}>
        <div className="pipeline-stage">
          <Scene variant="corridor" className="scene-layer scene-corridor" />
          <div className="container pipeline-inner">
            <SectionHead
              titleId="pipeline-heading"
              title="How the projects reach this page"
              intro={`This site is project ${projectNumber("portfolio-v2")}. Its project list starts as one TypeScript file and reaches you by two routes.`}
            >
              {/* Only the pinned layout shows it (pipeline.css): the list
                  layout is finished from the start, so it has nothing to count. */}
              <p className="pl-counter" aria-hidden="true">
                <span className="pl-counter-step">{step}</span>
                <span className="pl-counter-total">/{PIPELINE_NODES.length}</span>
              </p>
            </SectionHead>

            {/* The drawing. Its lines, routes and citations are hidden from
                assistive technology, which reads the same steps from the
                list below it; the nodes are buttons that open their code. */}
            <div
              className="pl-diagram"
              onPointerLeave={() => !held && setPeek(null)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closePeek();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && peek !== null) closePeek();
              }}
            >
              <div className="pl-route" data-on={routeOn} aria-hidden="true">
                <RouteLine
                  svgRef={routeRef}
                  box={routeBox}
                  draw={driven ? routeDraw : done}
                />
                <div className="pl-route-copy">
                  <span className="pl-route-label mono">
                    <Scramble text={breakable(PRERENDER_ROUTE.label)} trigger={{ active: stage !== null && stage.route }} />
                  </span>
                  <span className="pl-route-text small">{PRERENDER_ROUTE.text}</span>
                  <span className="pl-route-path mono">
                    {PIPELINE_NODES[0].label} <span className="pl-arrow" /> {PIPELINE_NODES[PIPELINE_NODES.length - 1].label}
                  </span>
                </div>
              </div>

              <div className="pl-nodes" ref={nodesRef}>
                {/* One rail behind the row: the opaque nodes cover it, so it
                    shows only in the gaps, as a connector from each node to
                    the next. */}
                <span className="pl-rail" aria-hidden="true">
                  <m.span className="pl-rail-fill" style={{ scaleX: driven ? railFill : done }} />
                  <m.span
                    className="pl-token-track"
                    style={{ x: driven ? tokenShift : doneShift, opacity: driven ? tokenOpacity : done }}
                  >
                    <span className="pl-token" />
                  </m.span>
                </span>
                {PIPELINE_NODES.map((node, i) => {
                  const col = { "--i": i + 1 } as CSSProperties;
                  const last = i === PIPELINE_NODES.length - 1;
                  return (
                    <Fragment key={node.label}>
                      <button
                        type="button"
                        className={`pl-node${i === 0 ? " is-first" : ""}${last ? " is-last" : ""}${peek === i ? " is-open" : ""}`}
                        data-on={lit(i)}
                        style={col}
                        aria-expanded={peek === i}
                        aria-controls={peek === i ? "pl-peek" : undefined}
                        onPointerEnter={(e) => {
                          if (pinned && e.pointerType === "mouse" && !held) setPeek(i);
                        }}
                        onFocus={() => {
                          if (!held) setPeek(i);
                        }}
                        onClick={() => {
                          if (peek === i && held) closePeek();
                          else {
                            setPeek(i);
                            setHeld(true);
                          }
                        }}
                      >
                        {/* Named by its visible text (WCAG 2.5.3), so a voice
                            user can say what they see; the purpose follows. */}
                        <span className="pl-node-label mono">
                          <Scramble text={breakable(node.label)} trigger={{ active: decoding(i) }} />
                        </span>
                        <span className="pl-node-text">{node.text}</span>
                        <span className="visually-hidden"> (show the code)</span>
                      </button>
                      {peek === i && PEEKS[node.source] && (
                        <div className="pl-peek" style={col}>
                          <CodePeek id="pl-peek" peek={PEEKS[node.source]} />
                        </div>
                      )}
                      {/* A node named after its own file needs no citation
                          under it saying the same thing again. */}
                      {node.source !== node.label && (
                        <span className="pl-cite mono" data-on={lit(i)} style={col} aria-hidden="true">
                          <PathText path={node.source} />
                        </span>
                      )}
                      {!last && <span className="pl-stem" data-on={lit(i + 1)} aria-hidden="true" />}
                    </Fragment>
                  );
                })}
              </div>

              <div className="pl-ci" data-on={ciOn} aria-hidden="true">
                <span className="pl-ci-text small">{CI_CHECK.text}</span>
                <span className="pl-cite mono">
                  <PathText path={CI_CHECK.source} />
                </span>
              </div>
            </div>

            <ol className="visually-hidden">
              {PIPELINE_NODES.map((node) => (
                <li key={node.label}>
                  {node.label}: {node.text} Source: {node.source}.
                </li>
              ))}
            </ol>
            <p className="visually-hidden">
              Second route, from {PIPELINE_NODES[0].label} straight to {PIPELINE_NODES[4].label}:{" "}
              {PRERENDER_ROUTE.label}. {PRERENDER_ROUTE.text} {CI_CHECK.text} Source: {CI_CHECK.source}.
            </p>
          </div>
        </div>
      </div>
      {/* After the pinned stage, so it never crowds the drawing on a short
          screen: the numbers arrive as the diagram lets go. */}
      <LiveReadout />
      <CommitStrip />
    </section>
  );
}

interface RouteLineProps {
  svgRef: RefObject<SVGSVGElement>;
  box: { w: number; h: number } | null;
  draw: MotionValue<number>;
}

// Corner radius of the route's two bends, in pixels.
const BEND = 14;

/**
 * The second route: up from the first node, across, and down into the last.
 *
 * Drawn in real pixels once the box has been measured, so the bends stay
 * round at every width. Before that (the prerendered HTML, or no
 * JavaScript) it is a plain bracket stretched over the box, finished.
 */
function RouteLine({ svgRef, box, draw }: RouteLineProps) {
  const endDot = useTransform(draw, [0.96, 1], [0, 1]);
  const startDot = useTransform(draw, [0, 0.02], [0, 1]);

  if (!box) {
    return (
      <svg ref={svgRef} className="pl-route-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0 100 V0 H100 V100" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  const { w, h } = box;
  const top = 0.5;
  const r = Math.min(BEND, h / 2, w / 4);
  const d = `M0.5 ${h} V${top + r} Q0.5 ${top} ${0.5 + r} ${top} H${w - 0.5 - r} Q${w - 0.5} ${top} ${w - 0.5} ${top + r} V${h}`;

  return (
    <svg ref={svgRef} className="pl-route-line" viewBox={`0 0 ${w} ${h}`}>
      <m.path d={d} style={{ pathLength: draw }} />
      <m.circle className="pl-route-dot" cx={0.5} cy={h} r={3} style={{ opacity: startDot }} />
      <m.circle className="pl-route-dot" cx={w - 0.5} cy={h} r={3} style={{ opacity: endDot }} />
    </svg>
  );
}
