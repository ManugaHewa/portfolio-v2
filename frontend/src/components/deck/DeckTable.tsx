import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, m, useMotionValue, useTransform } from "../../motion/m";
import type { MotionValue } from "../../motion/m";
import { useMotionAllowed, useReplayInView } from "../../motion";
import { cx } from "../../lib/cx";
import type { ProjectSummary } from "../../types";
import type { OpenProject } from "../work/Work";
import { CardBack, CardFace } from "./PlayingCard";
import { tableCards, thrown } from "./useDeck";
import type { Deck } from "./useDeck";

/*
 * Where the cards on the table lie, by how recently they were drawn: the
 * face-up card square to the eye with a slight cant, the ones under it
 * fanned out behind it to the left, each a little lower and smaller.
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
 * The table: the deck on the right, the drawn cards on the left (deck.css).
 *
 * Drawing takes the top card off the deck, lifts it, carries it across and
 * turns it face up as it lands, and the card that was face up slides back
 * into the fan behind it. The deck can be clicked, or its top card thrown
 * (a drag past 90px, or a flick), and the card then flies from where it was
 * let go. The Draw button beside the heading does the same for the keyboard
 * (DeckControls.tsx); the deck itself is decoration to assistive technology.
 *
 * The opening card is face up in the prerendered page and does not animate
 * in; under reduced motion or "Pause motion" every draw simply lands, with
 * no flight and no turn, and the top card cannot be dragged.
 */
export function DeckTable({ projects, deck, onOpen, reveal }: DeckTableProps) {
  const allowed = useMotionAllowed();
  const tableRef = useRef<HTMLDivElement>(null);
  // Each time the table comes into view, the top card lifts once, the way a
  // dealer's thumb lifts the next card: it can be picked up (deck.css).
  const inView = useReplayInView(tableRef, 0.6);
  const pileRef = useRef<HTMLDivElement>(null);
  // How far the deck sits from the drawn card's place, measured: the
  // distance a drawn card flies.
  const [span, setSpan] = useState(0);
  // Where a thrown card was let go, relative to the deck, for its flight.
  const launch = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const pile = pileRef.current;
    if (!pile || typeof ResizeObserver !== "function") return;
    const measure = () => setSpan(pile.offsetLeft);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pile);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    launch.current = null;
  }, [deck.drawn, deck.deal]);

  // With no reveal to follow, the table is simply in.
  const fullyIn = useMotionValue(1);
  const source = reveal ?? fullyIn;
  const opacity = useTransform(source, (v) => v);
  const y = useTransform(source, [0, 1], [48, 0]);
  const pointerEvents = useTransform(source, (v) => (v > 0.6 ? "auto" : "none"));

  const onTable = tableCards(deck);
  const opening = deck.deal === 0 && deck.drawn === 1;
  const pileLayers = Math.max(0, Math.min(deck.remaining - 1, 6));

  return (
    <m.div
      className="deck"
      style={reveal ? { opacity, y, pointerEvents } : undefined}
    >
      <div className={cx("deck-table", allowed && inView && "is-inviting")} ref={tableRef}>
        <div className="deck-pile" ref={pileRef} aria-hidden="true">
          {Array.from({ length: pileLayers }, (_, i) => (
            <span className="pcard is-pile" key={i} style={{ "--layer": pileLayers - i } as CSSProperties}>
              <CardBack />
            </span>
          ))}
          {deck.remaining > 0 ? (
            <m.div
              key={`top-${deck.deal}-${deck.drawn}`}
              className="pcard is-top"
              style={{ rotate: -4 }}
              drag={allowed}
              dragSnapToOrigin
              dragElastic={0.5}
              whileHover={allowed ? { y: -10, rotate: -7 } : undefined}
              whileTap={allowed ? { scale: 0.98 } : undefined}
              onDragStart={() => {
                dragged.current = true;
              }}
              onDragEnd={(_, info) => {
                if (thrown(info.offset, info.velocity)) {
                  launch.current = { x: span + info.offset.x, y: info.offset.y };
                  deck.draw();
                }
                // The click that ends a drag is not a draw of its own.
                setTimeout(() => {
                  dragged.current = false;
                }, 0);
              }}
              onClick={() => {
                if (!dragged.current) deck.draw();
              }}
            >
              <CardBack />
            </m.div>
          ) : (
            <span className="deck-empty mono">Deck empty</span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {onTable.map((index, rank) => {
            const p = projects[index];
            if (!p) return null;
            const isNew = rank === 0 && !opening;
            const from = launch.current ?? { x: span, y: 0 };
            const pose = FAN[rank];
            return (
              <m.div
                key={`${deck.deal}-${index}`}
                className={rank === 0 ? "pcard is-up" : "pcard is-under"}
                style={{ zIndex: 20 - rank }}
                aria-hidden={rank > 0 ? true : undefined}
                initial={allowed && isNew ? { x: from.x, y: from.y, rotate: -7, scale: 1 } : false}
                animate={
                  allowed && isNew
                    ? { x: pose.x, y: [from.y, from.y - 56, pose.y], rotate: pose.rotate, scale: [1, 1.06, pose.scale] }
                    : pose
                }
                exit={{ opacity: 0, transition: { duration: allowed ? 0.25 : 0 } }}
                transition={allowed ? (isNew ? FLIGHT : SETTLE) : { duration: 0 }}
              >
                <m.div
                  className="pcard-inner"
                  initial={allowed && isNew ? { rotateY: 180 } : false}
                  animate={{ rotateY: 0 }}
                  transition={allowed ? TURN : { duration: 0 }}
                >
                  <CardFace project={p} resting={rank > 0} onOpen={(button) => onOpen(p, button)} />
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
