import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, m, useMotionValue, useTransform } from "../../motion/m";
import type { MotionValue } from "../../motion/m";
import { morphId, useMotionAllowed, useReplayInView } from "../../motion";
import { cx } from "../../lib/cx";
import { onDealRequest, takeDeal } from "../../lib/dealRequest";
import type { OpenProject, ProjectSummary } from "../../types";
import { figureId } from "../work/workUtils";
import { Scene } from "../Scene";
import { CardBack, CardFace } from "./PlayingCard";
import { deckCards, tableCards, thrown } from "./useDeck";
import type { Deck } from "./useDeck";

/*
 * Where the drawn cards lie, by how recently they were drawn: the face-up
 * card square to the eye with a slight cant, the ones under it fanned out
 * behind it to the left, each a little lower and smaller.
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

interface DeckTableProps {
  projects: ProjectSummary[];
  deck: Deck;
  onOpen: OpenProject;
  /**
   * On the pinned hero, the table comes in as the gyroscope leaves for the
   * header: 0 hidden, 1 in place (Hero.tsx). Elsewhere it is simply there.
   */
  reveal?: MotionValue<number>;
}

/**
 * The table: the deck on the right, the drawn cards on the left (deck.css),
 * over a slow drift of motes (the "field" scene).
 *
 * - Drawing takes the top card off the deck, lifts it, carries it across
 *   and turns it face up as it lands; the card that was face up slides back
 *   into the fan behind it. The deck can be clicked, or its top card thrown
 *   (a drag past 90px, or a flick), and the card flies from where it was
 *   let go.
 * - Spread (beside the heading) fans the face-down cards out in an arc
 *   across the table: pick any one, by pointer or by keyboard (each is a
 *   button while spread), and that project is the one turned over.
 * - Shuffle sends the drawn cards back to the deck, riffles it in two
 *   halves, and deals the new top card.
 * - A project asked for elsewhere (a skill's number: lib/dealRequest.ts) is
 *   dealt as soon as the table is on screen.
 * - The face-up card is what its case study grows out of (ProjectModal.tsx).
 *
 * Every card keeps one element for as long as it is in the deck, so moving
 * between the pile, the spread and the riffle is one continuous movement.
 * The positions are computed from the measured table, in the deck's own
 * frame, so the prerendered page (where nothing is measured yet) is laid
 * out by CSS alone. The opening card is face up in the prerendered page and
 * does not animate in; under reduced motion or "Pause motion" every move
 * simply lands, and nothing can be dragged.
 */
export function DeckTable({ projects, deck, onOpen, reveal }: DeckTableProps) {
  const allowed = useMotionAllowed();
  const tableRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  // The deck's offset from the face-up slot, the x in the deck's frame that
  // centres a card on the table, and a card's height: measured.
  const [frame, setFrame] = useState({ span: 0, centre: 0, height: 0, reach: 1 });
  // Where the next face-up card starts from, in the slot's frame.
  const launch = useRef<Pose | null>(null);
  // The cards already on the table at the last render: a card pulled back to
  // the top from under the others moves up, it does not fly in again.
  const shown = useRef<Set<string>>(new Set());
  const dragged = useRef(false);
  // A spread card was picked by keyboard: focus goes to the card it turned over.
  const focusUp = useRef(false);
  // Each time the table comes into view, the top card lifts once, the way a
  // dealer's thumb lifts the next card: it can be picked up (deck.css).
  const inView = useReplayInView(tableRef, 0.6);

  useEffect(() => {
    const table = tableRef.current;
    const pile = pileRef.current;
    if (!table || !pile || typeof ResizeObserver !== "function") return;
    const measure = () => {
      const slot = table.querySelector<HTMLElement>(".pcard.is-up, .pcard.is-under");
      const slotLeft = slot?.offsetLeft ?? 40;
      setFrame({
        span: pile.offsetLeft - slotLeft,
        centre: (table.clientWidth - pile.offsetWidth) / 2 - pile.offsetLeft,
        height: pile.offsetHeight,
        // The full arc wants about 520px of table; a phone's gets less.
        reach: Math.min(1, Math.max(0.5, table.clientWidth / 520)),
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

  // With no reveal to follow, the table is simply in.
  const fullyIn = useMotionValue(1);
  const source = reveal ?? fullyIn;
  const opacity = useTransform(source, (v) => v);
  const lift = useTransform(source, [0, 1], [48, 0]);
  const pointerEvents = useTransform(source, (v) => (v > 0.6 ? "auto" : "none"));

  const opening = deck.deal === 0 && deck.drawn === 1;
  const spread = deck.spread && frame.height > 0;
  // The top of the deck as a drawn card sees it, in the slot's frame.
  const topCentre = spreadCentre(pilePose(0), frame.height);
  const fromDeck = { x: topCentre.x + frame.span, y: topCentre.y, rotate: topCentre.rotate };

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
        className={cx("deck-table", allowed && inView && !deck.spread && "is-inviting", spread && "is-spread")}
        ref={tableRef}
        onKeyDown={onTableKey}
      >
        <div className="deck-pile" ref={pileRef} aria-hidden={spread ? undefined : true}>
          {inDeck.map((index, depth) => {
            const top = depth === 0;
            const fan = spreadPose(depth, inDeck.length, frame.centre, frame.reach);
            const pose = spread ? fan : pilePose(depth);
            const side = depth % 2 === 0 ? -1 : 1;
            const riffle = allowed && deck.riffling;
            const pick = () => take(index, spreadCentre(fan, frame.height));
            return (
              <m.div
                key={`deck-${deck.deal}-${index}`}
                className={cx("pcard", "is-pile", top && "is-top", spread && "is-fanned")}
                style={{ zIndex: inDeck.length - depth }}
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
                      : SPREAD
                }
                drag={allowed && top && !spread}
                dragSnapToOrigin
                dragElastic={0.5}
                whileHover={
                  !allowed ? undefined : spread ? { y: fan.y - 26 } : top ? { y: -12, rotate: -4 } : undefined
                }
                whileFocus={spread && allowed ? { y: fan.y - 26 } : undefined}
                onDragStart={() => {
                  dragged.current = true;
                }}
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
                <CardBack />
              </m.div>
            );
          })}
          {inDeck.length === 0 && <span className="deck-empty mono">Deck empty</span>}
        </div>

        <AnimatePresence initial={false}>
          {onTable.map((index, rank) => {
            const p = projects[index];
            if (!p) return null;
            const key = keyOf(index);
            const fresh = rank === 0 && !opening && !shown.current.has(key);
            const from = launch.current ?? fromDeck;
            const pose = FAN[rank];
            const flying = allowed && fresh && !spread;
            return (
              <m.div
                key={key}
                id={rank === 0 ? morphId(p.slug) : undefined}
                className={rank === 0 ? "pcard is-up" : "pcard is-under"}
                style={{ zIndex: 40 - rank }}
                aria-hidden={rank > 0 || spread ? true : undefined}
                initial={flying ? { x: from.x, y: from.y, rotate: from.rotate, scale: 1 } : false}
                animate={
                  flying
                    ? {
                        x: pose.x,
                        y: [from.y, Math.min(from.y, 0) - 56, pose.y],
                        rotate: pose.rotate,
                        scale: [1, 1.06, pose.scale],
                        opacity: 1,
                      }
                    : { ...pose, opacity: spread ? 0.22 : 1, y: spread ? pose.y + 18 : pose.y }
                }
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
              >
                <m.div
                  className="pcard-inner"
                  initial={flying ? { rotateY: 180 } : false}
                  animate={{ rotateY: 0 }}
                  transition={allowed ? TURN : { duration: 0 }}
                >
                  <CardFace
                    project={p}
                    // While the deck is spread the drawn cards lie dimmed
                    // under the fan and out of reach: no button to tab to.
                    resting={rank > 0 || spread}
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
