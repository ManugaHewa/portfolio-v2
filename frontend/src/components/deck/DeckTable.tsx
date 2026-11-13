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

/*
 * Where the drawn cards lie, by how recently they were drawn: the face-up
 * card square to the eye with a slight cant, the ones under it fanned out
 * behind it to the left, each a little lower and smaller: the hand.
 */
const FAN = [
  { x: 0, y: 0, rotate: 1.5, scale: 1 },
  { x: -14, y: 10, rotate: -5, scale: 0.97 },
  { x: -26, y: 18, rotate: -10, scale: 0.94 },
  { x: -36, y: 24, rotate: -14, scale: 0.91 },
];

// The flight from the deck: a lift on the way, settling as it lands.
const FLIGHT = { duration: 0.75, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };
// The turn, a touch quicker than the flight so the face is up before it lands.
const TURN = { duration: 0.6, ease: [0.33, 1, 0.68, 1] as [number, number, number, number], delay: 0.05 };
const SETTLE = { type: "spring" as const, stiffness: 220, damping: 26 };
// The spread opening and closing: a little give, as cards slide on felt.
const SPREAD = { type: "spring" as const, stiffness: 170, damping: 20 };

// Every card in the deck turns about a point below it (deck.css, .is-pile):
// this far down, in card heights from the card's top. The spread uses the
// same point, so fanning out is one movement with nothing jumping as it
// starts.
const FAN_ORIGIN = 1.6;

/*
 * The ribbon spread and turnover (a cardistry flourish): when the table
 * first comes into view, the deck is spread in a line across it, turned
 * face up in one wave from the left, held so every card's corner shows,
 * turned back from the right, and gathered. Milliseconds.
 */
const RIBBON = {
  /** Each card's turn starts this long after the one to its left's. */
  waveStep: 55,
  turn: 450,
  hold: 700,
  backStep: 38,
  gather: 650,
};

/** When each part of the flourish starts, for `count` cards in the deck (ms). */
export function ribbonTimeline(count: number) {
  const up = 620;
  const down = up + RIBBON.waveStep * Math.max(0, count - 1) + RIBBON.turn + RIBBON.hold;
  const gather = down + RIBBON.backStep * Math.max(0, count - 1) + RIBBON.turn;
  return { up, down, gather, done: gather + RIBBON.gather };
}

// A type, not an interface: Motion's animate prop takes it as a target.
export type Pose = {
  x: number;
  y: number;
  rotate: number;
};

/** A card in the deck, `depth` from the top: the deck's thickness, down and to the right. */
export function pilePose(depth: number): Pose {
  const d = Math.min(depth, 6) * 1.6;
  return { x: d, y: d, rotate: -2 };
}

/**
 * A card in the ribbon: the top card stays where the deck is, at the right,
 * and each card under it lies a step further left, so the deck runs across
 * the whole table. `left` is how far the table's left edge is from the deck,
 * in the deck's frame. Each card lies over the one to its left, so the strip
 * of each that shows is its left edge, with its corner index.
 */
export function ribbonPose(depth: number, count: number, left: number): Pose {
  const step = count > 1 ? left / (count - 1) : 0;
  // "|| 0": the top card's -0 is a plain 0.
  return { x: -depth * step || 0, y: 0, rotate: 0 };
}

/**
 * A card in the spread: `k` of `count`, laid along an arc centred on the
 * table. `centre` is the x (in the deck's own frame) that puts a card in the
 * middle of the table; `reach` (0 to 1) narrows the arc on a narrow table.
 * The arc narrows too when few cards are left.
 */
export function spreadPose(k: number, count: number, centre: number, reach = 1): Pose {
  const max = Math.min(16, 2.6 * (count - 1)) * reach;
  const t = count > 1 ? k / (count - 1) : 0.5;
  return { x: centre, y: -12, rotate: -max + 2 * max * t };
}

/**
 * Where a deck card's centre really is, for a card turned about its own
 * centre (a drawn card) to start from there: the deck turns its cards about
 * a point FAN_ORIGIN card heights down, which also swings their centres out
 * along the arc.
 */
export function spreadCentre(pose: Pose, height: number): Pose {
  const r = (pose.rotate * Math.PI) / 180;
  const arm = (FAN_ORIGIN - 0.5) * height;
  return { x: pose.x + arm * Math.sin(r), y: pose.y + arm * (1 - Math.cos(r)), rotate: pose.rotate };
}

/**
 * How many cards a cut by hand takes, from where along the deck's edge the
 * pointer is: `at` is 0 at the top of the edge and 1 at the bottom, and the
 * packet runs from one card at the top to all but one at the bottom.
 */
export function cutAt(at: number, remaining: number): number {
  if (remaining < 2) return 0;
  return Math.max(1, Math.min(remaining - 1, Math.round(1 + Math.max(0, Math.min(1, at)) * (remaining - 2))));
}

/** How far a cut's top packet must be pulled out before letting go completes the cut (px). */
export const CUT_PULL = 60;

// Pressing the top card this long, still, lifts its corner (the squeeze);
// holding the face-up card this long on a touch screen brings it close.
const SQUEEZE_MS = 220;
const INSPECT_MS = 380;

type Flourish = "ribbon" | "up" | "down" | "gather" | null;

interface DeckTableProps {
  projects: ProjectSummary[];
  deck: Deck;
  onOpen: OpenProject;
  /**
   * On the pinned hero, the table comes in as the wheel leaves for the
   * header: 0 hidden, 1 in place (Hero.tsx). Elsewhere it is simply there.
   */
  reveal?: MotionValue<number>;
}

/**
 * The table: the deck on the right, the drawn cards on the left (deck.css),
 * over a slow drift of motes (the "field" scene).
 *
 * - The first time the table comes into view, the deck does a ribbon spread
 *   and turnover: spread across the table, turned face up in a wave so each
 *   project's corner shows, turned back and gathered.
 * - Drawing takes the top card off the deck, lifts it, carries it across
 *   and turns it face up as it lands; the card that was face up slides back
 *   into the hand behind it. The deck can be clicked, or its top card thrown
 *   (a drag past 90px, or a flick), and the card flies from where it was
 *   let go. A card in the hand can be picked back up with a click.
 * - Spread (beside the heading) fans the face-down cards out in an arc
 *   across the table: pick any one, by pointer or by keyboard (each is a
 *   button while spread), and that project is the one turned over.
 * - Shuffle sends the drawn cards back to the deck, riffles it in two
 *   halves, and deals the new top card.
 * - A project asked for elsewhere (a skill's number: lib/dealRequest.ts) is
 *   dealt as soon as the table is on screen.
 * - Pressing and holding the top card squeezes it: its corner lifts and the
 *   index on the face underneath shows, the next project's number. Letting
 *   go lays it flat again without drawing it.
 * - The deck's right edge cuts it: slide along the edge to choose how deep
 *   (the top packet lifts to show where), pull the packet out, and let go;
 *   it goes under the rest. C cuts near the middle from the keyboard.
 * - Drawing the last card throws every drawn card down the window in a
 *   bouncing cascade (lib/winCascade.ts).
 * - On a touch screen, holding the face-up card brings it up close to read;
 *   letting go puts it back.
 * - The face-up card is what its case study grows out of (ProjectModal.tsx).
 *
 * Every card keeps one element for as long as it is in the deck, so moving
 * between the pile, the ribbon, the spread and the riffle is one continuous
 * movement; each carries its face on its underside, for the turnover. The
 * positions are computed from the measured table, in the deck's own frame,
 * so the prerendered page (where nothing is measured yet) is laid out by CSS
 * alone. The opening card is face up in the prerendered page and does not
 * animate in; under reduced motion or "Pause motion" every move simply lands,
 * there is no flourish, and nothing can be dragged.
 */
export function DeckTable({ projects, deck, onOpen, reveal }: DeckTableProps) {
  const allowed = useMotionAllowed();
  const tableRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  // Measured: the deck's offset from the face-up slot, the x in the deck's
  // frame that centres a card on the table, how far left of the deck the
  // ribbon may run (the table, and the empty stretch between it and the
  // controls beside it), a card's height, and how wide a spread the table
  // takes.
  const [frame, setFrame] = useState({ span: 0, centre: 0, left: 0, height: 0, reach: 1, width: 0, slot: 40 });
  // Where the next face-up card starts from, in the slot's frame.
  const launch = useRef<Pose | null>(null);
  // The cards already on the table at the last render: a card pulled back to
  // the top from under the others moves up, it does not fly in again.
  const shown = useRef<Set<string>>(new Set());
  const dragged = useRef(false);
  // A spread card was picked by keyboard: focus goes to the card it turned over.
  const focusUp = useRef(false);
  // Each time the table comes into view the top card lifts once, the way a
  // dealer's thumb lifts the next card (deck.css); the first time, the whole
  // deck does the ribbon instead.
  const inView = useReplayInView(tableRef, 0.6);
  const [flourish, setFlourish] = useState<Flourish>(null);
  const flourished = useRef(false);
  const flourishTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // The squeeze: whether the top card's corner is lifted, and the hold that
  // lifts it. `took` marks a press that squeezed, so its click does not draw.
  const [squeezing, setSqueezing] = useState(false);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; took: boolean }>({
    timer: null,
    x: 0,
    y: 0,
    took: false,
  });
  // A cut by hand: the top packet's size, how far it has been pulled, and
  // whether it is held (a mouse just over the edge only shows the split).
  const [cut, setCut] = useState<{ k: number; x: number; y: number; held: boolean; out: boolean } | null>(null);
  const cutFrom = useRef({ x: 0, y: 0 });
  // The face-up card brought close on a touch screen.
  const [inspecting, setInspecting] = useState(false);
  const inspectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const table = tableRef.current;
    const pile = pileRef.current;
    if (!table || !pile || typeof ResizeObserver !== "function") return;
    const measure = () => {
      const slot = table.querySelector<HTMLElement>(".pcard.is-up, .pcard.is-under");
      const slotLeft = slot?.offsetLeft ?? 40;
      // Beside the controls (wide screens) the ribbon can run on into the
      // gap before them; below them (phones) it stays on the table.
      const controls = table.closest(".work-index")?.querySelector(".deck-controls")?.getBoundingClientRect();
      const tableLeft = table.getBoundingClientRect().left;
      const gap = controls && controls.right < tableLeft ? tableLeft - controls.right - 32 : 0;
      setFrame({
        span: pile.offsetLeft - slotLeft,
        centre: (table.clientWidth - pile.offsetWidth) / 2 - pile.offsetLeft,
        left: pile.offsetLeft + Math.max(0, Math.min(gap, pile.offsetWidth)),
        height: pile.offsetHeight,
        // The full arc wants about 520px of table; a phone's gets less.
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
    // Once the card has turned over.
    const t = setTimeout(
      () => tableRef.current?.querySelector<HTMLElement>(".pcard.is-up .pcard-open")?.focus(),
      450,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.drawn, deck.deal, deck.order]);

  // The ribbon, once, the first time the untouched deck is on screen.
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

  // Anything the visitor does ends the flourish where it is.
  const stopFlourish = () => {
    for (const t of flourishTimers.current) clearTimeout(t);
    flourishTimers.current = [];
    setFlourish(null);
  };
  useEffect(() => {
    if (!opening || deck.spread) stopFlourish();
  }, [opening, deck.spread]);
  useEffect(() => () => flourishTimers.current.forEach(clearTimeout), []);

  // A project asked for elsewhere: dealt once the table is on screen.
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

  // The last card drawn: once it has landed, every drawn card cascades down
  // the window. A shuffle, or motion being paused, ends it.
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

  // With no reveal to follow, the table is simply in.
  const fullyIn = useMotionValue(1);
  const source = reveal ?? fullyIn;
  const opacity = useTransform(source, (v) => v);
  const lift = useTransform(source, [0, 1], [48, 0]);
  const pointerEvents = useTransform(source, (v) => (v > 0.6 ? "auto" : "none"));

  const spread = deck.spread && frame.height > 0;
  const ribbon = flourish !== null && flourish !== "gather";
  // The drawn cards lie dimmed under the spread or the ribbon.
  const veiled = spread || ribbon;
  // The top of the deck as a drawn card sees it, in the slot's frame.
  const topCentre = spreadCentre(pilePose(0), frame.height);
  const fromDeck = { x: topCentre.x + frame.span, y: topCentre.y, rotate: topCentre.rotate };

  // A card's width, and the cut's top packet: lifted aside by a cut from the
  // keyboard, following the hand in a cut by hand, or lifted a little to
  // show where a cut would split the deck while a mouse is over its edge.
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

  // The squeeze. A hold that stays still lifts the corner; moving first
  // (a throw) or letting go before it does neither. Letting go anywhere
  // lays the corner down.
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

  // The cut by hand, on the strip along the deck's right edge.
  const depthAt = (el: HTMLElement, y: number) => {
    const r = el.getBoundingClientRect();
    return cutAt((y - r.top) / Math.max(1, r.height), inDeck.length);
  };
  const onCutMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (cut?.held) {
      const dx = e.clientX - cutFrom.current.x;
      const dy = e.clientY - cutFrom.current.y;
      // Along the edge, the depth follows the pointer; pulled sideways past
      // a few pixels, the packet comes out and its depth is set.
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
    // Back to a preview under a mouse still over the edge; otherwise nothing.
    setCut(e.pointerType === "mouse" && e.type === "pointerup" ? { k: cut.k, x: 0, y: 0, held: false, out: false } : null);
  };

  // Holding the face-up card on a touch screen, anywhere but its link.
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
            // The turnover runs from the left (the deepest card) to the right,
            // the turn back from the right.
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
                // A cut's packet, out of the deck, lies over everything on the
                // table until it goes back under.
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
                  // The click that ends a drag is not a draw of its own.
                  setTimeout(() => {
                    dragged.current = false;
                  }, 0);
                }}
                onClick={() => {
                  if (dragged.current) return;
                  // A squeeze is a look, not a draw.
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
                {/* The squeezed corner (deck.css): its face side, with the index. */}
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
          {/* The deck's edge, where it is cut by hand. The keyboard's C does
              the same, so this strip is for pointers alone. */}
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

        {/* Once every card is drawn, the joker turns up where the deck was:
            outside the deck's own (hidden) box, as it holds a link. */}
        <AnimatePresence>
          {inDeck.length === 0 && !deck.riffling && (
            <m.div
              key={`joker-${deck.deal}`}
              className="pcard is-joker-slot"
              // Tossed on top of the last card drawn, at an angle, so it is
              // seen: the deck is done, and here is what comes next.
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
            const inHand = rank > 0 && !veiled;
            // Brought close: to the middle of the table, square on, as large
            // as the window comfortably allows.
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
                // A long press would otherwise open the browser's own menu.
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
                transition={allowed ? (flying ? FLIGHT : SETTLE) : { duration: 0 }}
                // A card in the hand is picked back up with a click; the
                // keyboard has the list of every project beside the heading.
                onClick={inHand ? () => deck.pull(index) : undefined}
              >
                <m.div
                  className="pcard-inner"
                  initial={flying ? { rotateY: 180 } : false}
                  animate={{ rotateY: 0 }}
                  transition={allowed ? TURN : { duration: 0 }}
                >
                  <CardFace
                    project={p}
                    // While the deck is spread or ribboned the drawn cards lie
                    // dimmed under it and out of reach: no button to tab to.
                    resting={rank > 0 || veiled}
                    // On every drawn card from the moment it mounts: Motion
                    // only registers a shared element when it mounts, and a
                    // card pulled back to the top must still grow into its
                    // dialog. Only the face-up one ever opens one.
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
