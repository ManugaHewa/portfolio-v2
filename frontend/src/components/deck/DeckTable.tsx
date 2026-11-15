import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, m, useMotionValue, useTransform } from "../../motion/m";
import type { MotionValue } from "../../motion/m";
import { morphId, useMotionAllowed, useReplayInView } from "../../motion";
import { cx } from "../../lib/cx";
import { onDealRequest, takeDeal } from "../../lib/dealRequest";
import { runCascade } from "../../lib/winCascade";
import { projectNumber } from "../../stats";
import type { OpenProject, ProjectSummary } from "../../types";
import { figureId } from "../work/workUtils";
import { Scene } from "../Scene";
import { CardBack, CardFace, JokerFace, PeelCorner } from "./PlayingCard";
import { deckCards, tableCards, thrown } from "./useDeck";
import type { Deck } from "./useDeck";

/* The hand: the face-up card, then older draws fanned left, lower and smaller. */
const FAN = [
  { x: 0, y: 0, rotate: 1.5, scale: 1 },
  { x: -14, y: 10, rotate: -5, scale: 0.97 },
  { x: -26, y: 18, rotate: -10, scale: 0.94 },
  { x: -36, y: 24, rotate: -14, scale: 0.91 },
];

type Bezier = [number, number, number, number];

// Flight from the deck: lifts on the way, settles on landing.
const FLIGHT = { duration: 0.75, ease: [0.16, 1, 0.3, 1] as Bezier };
// The turn, quicker than the flight, so the face is up before it lands.
const TURN = { duration: 0.6, ease: [0.33, 1, 0.68, 1] as Bezier, delay: 0.05 };

/*
 * A draw from the shoe (deck.css .deck-shoe): slid out face down, then
 * lifted, turned and laid in the slot. SHOE_OUT is the share of the draw
 * spent sliding; SHOE_SLIDE the share of the way to the slot.
 */
const SHOE_DRAW = 1;
const SHOE_OUT = 0.42;
const SHOE_SLIDE = 0.6;
const SLIDE_EASE: Bezier = [0.3, 0, 0.2, 1];
const LAND_EASE: Bezier = [0.16, 1, 0.3, 1];
const SHOE_FLIGHT = {
  duration: SHOE_DRAW,
  ease: LAND_EASE,
  x: { duration: SHOE_DRAW, times: [0, SHOE_OUT, 1], ease: [SLIDE_EASE, LAND_EASE] },
  y: { duration: SHOE_DRAW, times: [0, SHOE_OUT, 0.7, 1], ease: [SLIDE_EASE, [0.3, 0, 0.4, 1] as Bezier, LAND_EASE] },
  rotate: { duration: SHOE_DRAW, times: [0, SHOE_OUT, 1], ease: [SLIDE_EASE, LAND_EASE] },
  scale: { duration: SHOE_DRAW, times: [0, SHOE_OUT, 0.7, 1], ease: [SLIDE_EASE, [0.3, 0, 0.4, 1] as Bezier, LAND_EASE] },
};
const SHOE_TURN = { duration: SHOE_DRAW, times: [0, SHOE_OUT + 0.04, 1], ease: [SLIDE_EASE, [0.33, 1, 0.68, 1] as Bezier] };
const SETTLE = { type: "spring" as const, stiffness: 220, damping: 26 };
// Spread open and close: a little give, like cards on felt.
const SPREAD = { type: "spring" as const, stiffness: 170, damping: 20 };

// Deck cards pivot this many card heights below their top (deck.css
// .is-pile); the spread shares the pivot, so nothing jumps.
const FAN_ORIGIN = 1.6;

/*
 * Ribbon spread and turnover, on first view: the deck spreads across the
 * table, turns face up in a wave from the left, holds, turns back from the
 * right and gathers. Milliseconds.
 */
const RIBBON = {
  /** Delay between neighbouring cards' turns. */
  waveStep: 55,
  turn: 450,
  hold: 700,
  backStep: 38,
  gather: 650,
};

/** Start of each flourish phase for `count` deck cards (ms). */
export function ribbonTimeline(count: number) {
  const up = 620;
  const down = up + RIBBON.waveStep * Math.max(0, count - 1) + RIBBON.turn + RIBBON.hold;
  const gather = down + RIBBON.backStep * Math.max(0, count - 1) + RIBBON.turn;
  return { up, down, gather, done: gather + RIBBON.gather };
}

// A type, not an interface, so Motion's animate prop accepts it.
export type Pose = {
  x: number;
  y: number;
  rotate: number;
};

/** A deck card `depth` from the top: offset down-right for thickness. */
export function pilePose(depth: number): Pose {
  const d = Math.min(depth, 6) * 1.6;
  return { x: d, y: d, rotate: -2 };
}

/**
 * A ribbon card: the top stays on the deck, each lower card a step further
 * left, so the strip that shows is each card's left edge and index. `left`
 * is the distance to the table's left edge, in the deck's frame.
 */
export function ribbonPose(depth: number, count: number, left: number): Pose {
  const step = count > 1 ? left / (count - 1) : 0;
  // "|| 0" turns -0 into 0.
  return { x: -depth * step || 0, y: 0, rotate: 0 };
}

/**
 * Spread card `k` of `count`, on an arc centred on the table. `centre` is
 * the deck-frame x of the table's middle; `reach` (0-1) narrows the arc on
 * small tables, as do fewer cards.
 */
export function spreadPose(k: number, count: number, centre: number, reach = 1): Pose {
  const max = Math.min(16, 2.6 * (count - 1)) * reach;
  const t = count > 1 ? k / (count - 1) : 0.5;
  return { x: centre, y: -12, rotate: -max + 2 * max * t };
}

/**
 * A deck card's true centre, so a drawn card (which turns about its own
 * centre) can start there: deck cards pivot FAN_ORIGIN heights down, which
 * swings their centres along the arc.
 */
export function spreadCentre(pose: Pose, height: number): Pose {
  const r = (pose.rotate * Math.PI) / 180;
  const arm = (FAN_ORIGIN - 0.5) * height;
  return { x: pose.x + arm * Math.sin(r), y: pose.y + arm * (1 - Math.cos(r)), rotate: pose.rotate };
}

/**
 * Hand-cut size from the pointer's place on the deck edge: `at` 0 (top) gives
 * one card, 1 (bottom) all but one.
 */
export function cutAt(at: number, remaining: number): number {
  if (remaining < 2) return 0;
  return Math.max(1, Math.min(remaining - 1, Math.round(1 + Math.max(0, Math.min(1, at)) * (remaining - 2))));
}

/** Pull distance needed for a release to complete a cut (px). */
export const CUT_PULL = 60;

// Hold still this long on the top card to squeeze it; on touch, hold the
// face-up card this long to bring it close.
const SQUEEZE_MS = 220;
const INSPECT_MS = 380;

type Flourish = "ribbon" | "up" | "down" | "gather" | null;

interface DeckTableProps {
  projects: ProjectSummary[];
  deck: Deck;
  onOpen: OpenProject;
  /** Pinned hero only: table entrance as the wheel docks, 0 hidden to 1 in place (Hero.tsx). */
  reveal?: MotionValue<number>;
}

/**
 * The table: deck on the right, drawn cards on the left (deck.css), over the
 * "field" scene.
 *
 * - First view: ribbon spread and turnover.
 * - Draw: the top card slides out of the shoe face down, lifts, turns and
 *   lands; the old face-up card joins the hand. Click the deck or throw its
 *   top card (drag past 90px or flick). Click a hand card to pick it back up.
 * - Spread fans the deck in an arc; pick a card by pointer or keyboard.
 * - Shuffle gathers, riffles and deals the new top card.
 * - Requests from elsewhere (lib/dealRequest.ts) deal once the table is on screen.
 * - Hold the top card to squeeze its corner and peek at the next number.
 * - Cut by hand on the deck's right edge: slide to choose the depth, pull
 *   the packet out, release. C cuts from the keyboard.
 * - The last draw sets off the win cascade (lib/winCascade.ts).
 * - On touch, holding the face-up card brings it close.
 * - The face-up card grows into its case study dialog (ProjectModal.tsx).
 *
 * Each card keeps one element while in the deck, so pile, ribbon, spread
 * and riffle are continuous moves. Poses come from the measured table, so
 * the prerender is laid out by CSS alone; the opening card is already face
 * up. Under reduced motion or "Pause motion", moves land at once, with no
 * flourish and no dragging.
 */
export function DeckTable({ projects, deck, onOpen, reveal }: DeckTableProps) {
  const allowed = useMotionAllowed();
  const tableRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  // Measured: deck offset from the face-up slot (span), deck-frame x of the
  // table's middle (centre), how far left the ribbon may run, card height,
  // spread reach, table width and slot x.
  const [frame, setFrame] = useState({ span: 0, centre: 0, left: 0, height: 0, reach: 1, width: 0, slot: 40 });
  // Start pose of the next face-up card, in the slot's frame.
  const launch = useRef<Pose | null>(null);
  // Cards on the table at the last render: a card raised from the hand moves up instead of flying in.
  const shown = useRef<Set<string>>(new Set());
  const dragged = useRef(false);
  // A spread card picked by keyboard: focus its face-up card next.
  const focusUp = useRef(false);
  // Each view lifts the top card once (deck.css); the first view does the ribbon.
  const inView = useReplayInView(tableRef, 0.6);
  const [flourish, setFlourish] = useState<Flourish>(null);
  const flourished = useRef(false);
  const flourishTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // Squeeze state and its hold timer; `took` stops the press's click from drawing.
  const [squeezing, setSqueezing] = useState(false);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; took: boolean }>({
    timer: null,
    x: 0,
    y: 0,
    took: false,
  });
  // Hand cut: packet size, pull offset, and whether held (hovering only previews).
  const [cut, setCut] = useState<{ k: number; x: number; y: number; held: boolean; out: boolean } | null>(null);
  const cutFrom = useRef({ x: 0, y: 0 });
  // Face-up card brought close (touch).
  const [inspecting, setInspecting] = useState(false);
  const inspectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const table = tableRef.current;
    const pile = pileRef.current;
    if (!table || !pile || typeof ResizeObserver !== "function") return;
    const measure = () => {
      const slot = table.querySelector<HTMLElement>(".pcard.is-up, .pcard.is-under");
      const slotLeft = slot?.offsetLeft ?? 40;
      // On wide screens the ribbon may run into the gap before the controls.
      const controls = table.closest(".work-index")?.querySelector(".deck-controls")?.getBoundingClientRect();
      const tableLeft = table.getBoundingClientRect().left;
      const gap = controls && controls.right < tableLeft ? tableLeft - controls.right - 32 : 0;
      setFrame({
        span: pile.offsetLeft - slotLeft,
        centre: (table.clientWidth - pile.offsetWidth) / 2 - pile.offsetLeft,
        left: pile.offsetLeft + Math.max(0, Math.min(gap, pile.offsetWidth)),
        height: pile.offsetHeight,
        // The full arc needs about 520px.
        reach: Math.min(1, Math.max(0.5, table.clientWidth / 520)),
        width: table.clientWidth,
        slot: slotLeft,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    return () => ro.disconnect();
  }, []);

  const onTable = tableCards(deck);
  const inDeck = deckCards(deck);
  const keyOf = (index: number) => `${deck.deal}-${index}`;
  const opening = deck.deal === 0 && deck.drawn === 1;

  useEffect(() => {
    shown.current = new Set(onTable.map(keyOf));
    launch.current = null;
    if (!focusUp.current) return;
    focusUp.current = false;
    // After the turn.
    const t = setTimeout(
      () => tableRef.current?.querySelector<HTMLElement>(".pcard.is-up .pcard-open")?.focus(),
      450,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.drawn, deck.deal, deck.order]);

  // The ribbon, once, when the untouched deck is first on screen.
  useEffect(() => {
    if (flourished.current || !allowed || !inView || frame.height === 0 || !opening || deck.spread) return;
    flourished.current = true;
    const t = ribbonTimeline(inDeck.length);
    const at = (ms: number, phase: Flourish) =>
      flourishTimers.current.push(setTimeout(() => setFlourish(phase), ms));
    setFlourish("ribbon");
    at(t.up, "up");
    at(t.down, "down");
    at(t.gather, "gather");
    at(t.done, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, inView, frame.height, opening, deck.spread]);

  // Any interaction ends the flourish.
  const stopFlourish = () => {
    for (const t of flourishTimers.current) clearTimeout(t);
    flourishTimers.current = [];
    setFlourish(null);
  };
  useEffect(() => {
    if (!opening || deck.spread) stopFlourish();
  }, [opening, deck.spread]);
  useEffect(() => () => flourishTimers.current.forEach(clearTimeout), []);

  // Deal requests from elsewhere, once the table is on screen.
  const { pull } = deck;
  useEffect(() => {
    const deal = () => {
      if (!inView) return;
      const slug = takeDeal();
      const index = slug ? projects.findIndex((p) => p.slug === slug) : -1;
      if (index >= 0) pull(index);
    };
    deal();
    return onDealRequest(deal);
  }, [inView, projects, pull]);

  // Timers outliving the table.
  useEffect(
    () => () => {
      if (hold.current.timer) clearTimeout(hold.current.timer);
      if (inspectTimer.current) clearTimeout(inspectTimer.current);
    },
    [],
  );

  // After the last card lands, the cascade runs; a shuffle or pause ends it.
  const remainingBefore = useRef(inDeck.length);
  useEffect(() => {
    const before = remainingBefore.current;
    remainingBefore.current = inDeck.length;
    if (!allowed || before === 0 || inDeck.length !== 0 || deck.riffling) return;
    let stop: (() => void) | null = null;
    const landed = setTimeout(() => {
      const slot = tableRef.current?.querySelector<HTMLElement>(".pcard.is-up");
      if (!slot) return;
      const cards = tableCards(deck, deck.order.length).map((i) => ({
        rank: projectNumber(projects[i].slug),
        tier: projects[i].tier,
        title: projects[i].title,
      }));
      stop = runCascade(slot.getBoundingClientRect(), cards);
    }, 900);
    return () => {
      clearTimeout(landed);
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inDeck.length, allowed]);

  // No reveal: fully in.
  const fullyIn = useMotionValue(1);
  const source = reveal ?? fullyIn;
  const opacity = useTransform(source, (v) => v);
  const lift = useTransform(source, [0, 1], [48, 0]);
  const pointerEvents = useTransform(source, (v) => (v > 0.6 ? "auto" : "none"));

  const spread = deck.spread && frame.height > 0;
  const ribbon = flourish !== null && flourish !== "gather";
  // Drawn cards dim under the spread or ribbon.
  const veiled = spread || ribbon;
  // Deck top in the slot's frame.
  const topCentre = spreadCentre(pilePose(0), frame.height);
  const fromDeck = { x: topCentre.x + frame.span, y: topCentre.y, rotate: topCentre.rotate };

  // The cut packet's pose: following the hand, previewing under a hovering
  // mouse, or held aside by a keyboard cut.
  const cardW = frame.height / 1.4;
  const lifted = cut ? cut.k : deck.cutting;
  const packet: Pose | null = cut
    ? cut.out
      ? { x: cut.x, y: cut.y - 12, rotate: Math.max(-8, Math.min(8, cut.x * 0.03)) - 2 }
      : { x: -3, y: -10, rotate: -2 }
    : deck.cutting
      ? { x: -cardW * 0.62, y: -26, rotate: -8 }
      : null;
  const canCut = allowed && !spread && flourish === null && !deck.riffling && !deck.cutting && inDeck.length >= 2;
  const canSqueeze = allowed && !spread && flourish === null && !deck.riffling && !deck.cutting && !cut;
  useEffect(() => {
    if (!canCut) setCut(null);
  }, [canCut]);

  // Squeeze: a still hold lifts the corner; moving first (a throw) cancels.
  // Releasing anywhere lays it down.
  const startSqueeze = (x: number, y: number) => {
    hold.current = { timer: null, x, y, took: false };
    hold.current.timer = setTimeout(() => {
      hold.current.timer = null;
      hold.current.took = true;
      setSqueezing(true);
    }, SQUEEZE_MS);
    const end = () => {
      if (hold.current.timer) clearTimeout(hold.current.timer);
      hold.current.timer = null;
      setSqueezing(false);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const stillHolding = (x: number, y: number) => {
    if (hold.current.timer && Math.hypot(x - hold.current.x, y - hold.current.y) > 6) {
      clearTimeout(hold.current.timer);
      hold.current.timer = null;
    }
  };

  // Hand cut, on the strip along the deck's right edge.
  const depthAt = (el: HTMLElement, y: number) => {
    const r = el.getBoundingClientRect();
    return cutAt((y - r.top) / Math.max(1, r.height), inDeck.length);
  };
  const onCutMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (cut?.held) {
      const dx = e.clientX - cutFrom.current.x;
      const dy = e.clientY - cutFrom.current.y;
      // Along the edge the depth follows the pointer; pulled sideways, the packet comes out.
      if (!cut.out && Math.abs(dx) < 18) {
        const k = depthAt(e.currentTarget, e.clientY);
        if (k !== cut.k) setCut({ ...cut, k });
        return;
      }
      if (!cut.out) cutFrom.current.y = e.clientY;
      setCut({ ...cut, out: true, x: dx, y: cut.out ? dy : 0 });
      return;
    }
    if (e.pointerType !== "mouse") return;
    const k = depthAt(e.currentTarget, e.clientY);
    if (!cut || cut.k !== k) setCut({ k, x: 0, y: 0, held: false, out: false });
  };
  const onCutDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    cutFrom.current = { x: e.clientX, y: e.clientY };
    setCut({ k: depthAt(e.currentTarget, e.clientY), x: 0, y: 0, held: true, out: false });
  };
  const onCutUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!cut?.held) return;
    if (e.type === "pointerup" && cut.out && Math.hypot(cut.x, cut.y) > CUT_PULL) deck.cutAt(cut.k);
    // A mouse still over the edge goes back to previewing.
    setCut(e.pointerType === "mouse" && e.type === "pointerup" ? { k: cut.k, x: 0, y: 0, held: false, out: false } : null);
  };

  // Touch hold on the face-up card (not its button).
  const startInspect = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch" || (e.target as Element).closest(".pcard-open")) return;
    if (inspectTimer.current) clearTimeout(inspectTimer.current);
    inspectTimer.current = setTimeout(() => {
      inspectTimer.current = null;
      setInspecting(true);
    }, INSPECT_MS);
    const end = () => {
      if (inspectTimer.current) clearTimeout(inspectTimer.current);
      inspectTimer.current = null;
      setInspecting(false);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const take = (index: number, from: Pose) => {
    launch.current = { x: from.x + frame.span, y: from.y, rotate: from.rotate };
    deck.pull(index);
  };

  const onTableKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" && deck.spread) deck.setSpread(false);
  };

  return (
    <m.div className="deck" style={reveal ? { opacity, y: lift, pointerEvents } : undefined}>
      <Scene variant="field" className="scene-layer deck-scene" />
      <div
        className={cx(
          "deck-table",
          allowed && inView && !deck.spread && flourish === null && flourished.current && "is-inviting",
          veiled && "is-spread",
        )}
        ref={tableRef}
        onKeyDown={onTableKey}
        onPointerDown={() => {
          if (flourish !== null) stopFlourish();
        }}
      >
        <div className="deck-pile" ref={pileRef} aria-hidden={spread ? undefined : true}>
          {/* The shoe, under the cards (deck.css). */}
          <div className="deck-shoe" aria-hidden="true" />
          {inDeck.map((index, depth) => {
            const p = projects[index];
            const top = depth === 0;
            const fan = spreadPose(depth, inDeck.length, frame.centre, frame.reach);
            const base = spread ? fan : ribbon ? ribbonPose(depth, inDeck.length, frame.left) : pilePose(depth);
            const inPacket = packet !== null && depth < lifted;
            const pose = inPacket
              ? { x: base.x + packet.x, y: base.y + packet.y, rotate: base.rotate + packet.rotate }
              : base;
            const side = depth % 2 === 0 ? -1 : 1;
            const riffle = allowed && deck.riffling;
            const pick = () => take(index, spreadCentre(fan, frame.height));
            // Turnover runs left to right (deepest first); the turn back, right to left.
            const faceUp = flourish === "up";
            const turnDelay =
              flourish === "up"
                ? ((inDeck.length - 1 - depth) * RIBBON.waveStep) / 1000
                : flourish === "down"
                  ? (depth * RIBBON.backStep) / 1000
                  : 0;
            return (
              <m.div
                key={`deck-${deck.deal}-${index}`}
                className={cx("pcard", "is-pile", top && "is-top", spread && "is-fanned", top && squeezing && "is-squeezed")}
                // A packet out of the deck lies above the table until it goes under.
                style={{ zIndex: (inPacket && (cut?.out || deck.cutting > 0) ? 60 : 0) + inDeck.length - depth }}
                initial={false}
                animate={
                  riffle
                    ? {
                        x: [pose.x, pose.x + side * 64, pose.x],
                        y: [pose.y, pose.y - 18, pose.y],
                        rotate: [pose.rotate, pose.rotate + side * 5, pose.rotate],
                      }
                    : pose
                }
                transition={
                  !allowed
                    ? { duration: 0 }
                    : riffle
                      ? { duration: 0.62, delay: 0.32 + depth * 0.028, ease: [0.65, 0, 0.35, 1] }
                      : flourish === "ribbon"
                        ? { ...SPREAD, delay: (inDeck.length - 1 - depth) * 0.018 }
                        : inPacket && cut?.out
                          ? { duration: 0 }
                          : SPREAD
                }
                drag={allowed && top && !spread && flourish === null && !cut && !deck.cutting}
                dragSnapToOrigin
                dragElastic={0.5}
                whileHover={
                  !allowed || ribbon
                    ? undefined
                    : spread
                      ? { y: fan.y - 26 }
                      : top
                        ? { y: -12, rotate: -4 }
                        : undefined
                }
                whileFocus={spread && allowed ? { y: fan.y - 26 } : undefined}
                onDragStart={() => {
                  dragged.current = true;
                  if (hold.current.timer) clearTimeout(hold.current.timer);
                  hold.current.timer = null;
                  setSqueezing(false);
                }}
                onPointerDown={
                  top && canSqueeze
                    ? (e: ReactPointerEvent<HTMLDivElement>) => {
                        if (e.button === 0) startSqueeze(e.clientX, e.clientY);
                      }
                    : undefined
                }
                onPointerMove={top ? (e: ReactPointerEvent<HTMLDivElement>) => stillHolding(e.clientX, e.clientY) : undefined}
                onDragEnd={(_, info) => {
                  if (thrown(info.offset, info.velocity)) {
                    launch.current = {
                      x: fromDeck.x + info.offset.x,
                      y: fromDeck.y + info.offset.y,
                      rotate: fromDeck.rotate,
                    };
                    deck.draw();
                  }
                  // The click ending a drag is not a draw.
                  setTimeout(() => {
                    dragged.current = false;
                  }, 0);
                }}
                onClick={() => {
                  if (dragged.current) return;
                  // A squeeze is not a draw.
                  if (hold.current.took) {
                    hold.current.took = false;
                    return;
                  }
                  if (spread) pick();
                  else if (top) deck.draw();
                }}
                {...(spread
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": `Face-down card ${depth + 1} of ${inDeck.length}: turn it over`,
                      onKeyDown: (e: ReactKeyboardEvent) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        focusUp.current = true;
                        pick();
                      },
                    }
                  : {})}
              >
                <m.div
                  className="pcard-inner"
                  initial={false}
                  animate={{ rotateY: faceUp ? 0 : 180 }}
                  transition={
                    allowed
                      ? { duration: RIBBON.turn / 1000, delay: turnDelay, ease: [0.45, 0, 0.25, 1] }
                      : { duration: 0 }
                  }
                >
                  {p && <CardFace project={p} resting />}
                  <CardBack />
                </m.div>
                {/* Squeezed corner: its face side, with the index (deck.css). */}
                {top && p && (
                  <span className="pcard-peel" aria-hidden="true">
                    <span className="pcard-peel-flap">
                      <PeelCorner project={p} />
                    </span>
                  </span>
                )}
              </m.div>
            );
          })}
          {/* Edge strip for hand cuts; pointers only (keyboard uses C). */}
          {canCut && (
            <div
              className={cx("deck-cut", cut?.held && "is-held")}
              aria-hidden="true"
              onPointerDown={onCutDown}
              onPointerMove={onCutMove}
              onPointerUp={onCutUp}
              onPointerCancel={onCutUp}
              onPointerLeave={(e) => {
                if (!cut?.held && e.pointerType === "mouse") setCut(null);
              }}
            />
          )}
        </div>

        {/* The joker, once the deck is empty: outside the aria-hidden pile, since it holds a link. */}
        <AnimatePresence>
          {inDeck.length === 0 && !deck.riffling && (
            <m.div
              key={`joker-${deck.deal}`}
              className="pcard is-joker-slot"
              // Tossed at an angle over the last card, so it is noticed.
              initial={allowed ? { rotateY: -90, opacity: 0, x: 30, y: 24, rotate: 5 } : false}
              animate={{ rotateY: 0, opacity: 1, x: 30, y: 24, rotate: 5 }}
              exit={{ opacity: 0, transition: { duration: allowed ? 0.2 : 0 } }}
              transition={allowed ? { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.35 } : { duration: 0 }}
            >
              <JokerFace />
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {onTable.map((index, rank) => {
            const p = projects[index];
            if (!p) return null;
            const key = keyOf(index);
            const fresh = rank === 0 && !opening && !shown.current.has(key);
            const from = launch.current ?? fromDeck;
            const pose = FAN[rank];
            const flying = allowed && fresh && !spread;
            // Drawn plainly (not thrown or picked): dealt from the shoe.
            const dealt = flying && launch.current === null;
            const mouth = from.x - (from.x - pose.x) * SHOE_SLIDE;
            const inHand = rank > 0 && !veiled;
            // Brought close: centred, square, as large as the window allows.
            const close =
              rank === 0 && inspecting && !veiled
                ? {
                    x: (frame.width - cardW) / 2 - frame.slot,
                    y: pose.y - 12,
                    rotate: 0,
                    scale: Math.min(1.45, (window.innerWidth - 24) / Math.max(1, cardW)),
                    opacity: 1,
                  }
                : null;
            return (
              <m.div
                key={key}
                id={rank === 0 ? morphId(p.slug) : undefined}
                className={cx("pcard", rank === 0 ? "is-up" : "is-under", inHand && "is-in-hand", close && "is-close")}
                style={{ zIndex: close ? 70 : 40 - rank }}
                aria-hidden={rank > 0 || veiled ? true : undefined}
                initial={flying ? { x: from.x, y: from.y, rotate: from.rotate, scale: 1 } : false}
                animate={
                  close
                    ? close
                    : dealt
                    ? {
                        x: [from.x, mouth, pose.x],
                        y: [from.y, from.y + 3, Math.min(from.y, 0) - 40, pose.y],
                        rotate: [from.rotate, from.rotate, pose.rotate],
                        scale: [1, 1, 1.05, pose.scale],
                        opacity: 1,
                      }
                    : flying
                    ? {
                        x: pose.x,
                        y: [from.y, Math.min(from.y, 0) - 56, pose.y],
                        rotate: pose.rotate,
                        scale: [1, 1.06, pose.scale],
                        opacity: 1,
                      }
                    : { ...pose, opacity: veiled ? 0.22 : 1, y: veiled ? pose.y + 18 : pose.y }
                }
                onPointerDown={rank === 0 && !veiled ? startInspect : undefined}
                // Stops the long-press context menu.
                onContextMenu={
                  rank === 0
                    ? (e: ReactMouseEvent) => {
                        if (inspecting || inspectTimer.current) e.preventDefault();
                      }
                    : undefined
                }
                whileHover={inHand && allowed ? { y: pose.y - 8 } : undefined}
                exit={
                  allowed
                    ? {
                        x: fromDeck.x,
                        y: fromDeck.y,
                        rotate: fromDeck.rotate,
                        scale: 1,
                        opacity: 0,
                        transition: { duration: 0.34, ease: [0.65, 0, 0.35, 1] },
                      }
                    : { opacity: 0, transition: { duration: 0 } }
                }
                transition={allowed ? (dealt ? SHOE_FLIGHT : flying ? FLIGHT : SETTLE) : { duration: 0 }}
                // Click a hand card to raise it; keyboard users have the project list.
                onClick={inHand ? () => deck.pull(index) : undefined}
              >
                <m.div
                  className="pcard-inner"
                  initial={flying ? { rotateY: 180 } : false}
                  animate={{ rotateY: dealt ? [180, 180, 0] : 0 }}
                  transition={allowed ? (dealt ? SHOE_TURN : TURN) : { duration: 0 }}
                >
                  <CardFace
                    project={p}
                    // No button while veiled or under the top card.
                    resting={rank > 0 || veiled}
                    // Set from mount: Motion registers shared elements only on
                    // mount, and a raised hand card must still morph.
                    layoutId={figureId(p.slug)}
                    onOpen={(button) => onOpen(p, button)}
                  />
                  <CardBack />
                </m.div>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </m.div>
  );
}
