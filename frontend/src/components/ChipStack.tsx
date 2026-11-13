import { AnimatePresence, m } from "../motion/m";
import { useMotionAllowed } from "../motion";

/** Where the message is: not sent, on its way, answered, or turned back. */
export type ChipState = "idle" | "sending" | "sent" | "error";

// One chip's side band, front half, `y` its top edge, in a 34-wide box: the
// rim's front arc, down the chip's thickness, and back along the arc.
const RX = 15;
const RY = 5.5;
const THICK = 5;
const CX = 17;
const band = (y: number) =>
  `M${CX - RX} ${y}A${RX} ${RY} 0 0 0 ${CX + RX} ${y}V${y + THICK}A${RX} ${RY} 0 0 1 ${CX - RX} ${y + THICK}Z`;
// The spots on a chip's edge, where the front arc puts them.
const SPOTS = [-10, 0, 10].map((dx) => ({ x: CX + dx, dy: RY * Math.sqrt(1 - (dx / RX) ** 2) }));

// Bottom to top. Ember chips with a sky one in among them.
const STACK = ["ember", "ember", "sky", "ember", "ember"] as const;
const TOP = 12;
const yOf = (i: number) => TOP + (STACK.length - 1 - i) * THICK;

function Chip({ ink, y, face }: { ink: "ember" | "sky"; y: number; face: boolean }) {
  return (
    <>
      <path className={`chip-band is-${ink}`} d={band(y)} />
      {SPOTS.map((s) => (
        <rect key={s.x} className="chip-spot" x={s.x - 1.5} y={y + s.dy + 0.6} width={3} height={THICK - 1.2} />
      ))}
      {face && (
        <>
          <ellipse className={`chip-face is-${ink}`} cx={CX} cy={y} rx={RX} ry={RY} />
          <ellipse className="chip-inlay" cx={CX} cy={y} rx={RX - 5} ry={RY - 1.9} />
        </>
      )}
    </>
  );
}

/**
 * The stake on the contact form (ContactForm.tsx): pressing send pushes a
 * short stack of chips out from under the button, all in, the top ones a
 * moment behind the bottom ones as a pushed stack is. The server's yes drops
 * one more chip on top; a failure slides the stack back. Driven by the
 * request itself, like the send trace under it, so it stands there for as
 * long as the network takes.
 *
 * Decoration: aria-hidden, and the trace's status line says what is
 * happening. Under reduced motion or "Pause motion" it simply appears and
 * goes.
 */
export function ChipStack({ state }: { state: ChipState }) {
  const animate = useMotionAllowed();
  const out = state === "sending" || state === "sent";

  return (
    <AnimatePresence>
      {out && (
        <m.span
          className="chip-stack"
          aria-hidden="true"
          key="stack"
          // Turned back: the stack slides home under the button.
          exit={{ x: animate ? -28 : 0, opacity: 0, transition: { duration: animate ? 0.3 : 0, ease: [0.65, 0, 0.35, 1] } }}
        >
          <svg viewBox="0 0 34 46" width="34" height="46" focusable="false">
            {STACK.map((ink, i) => (
              <m.g
                key={i}
                initial={animate ? { x: -44, opacity: 0 } : false}
                animate={{ x: 0, opacity: 1 }}
                // The bottom chip moves first; the ones on it follow a
                // beat behind, so the stack leans back and rights itself.
                transition={
                  animate
                    ? { x: { type: "spring", stiffness: 340, damping: 24, delay: i * 0.035 }, opacity: { duration: 0.12, delay: i * 0.035 } }
                    : { duration: 0 }
                }
              >
                <Chip ink={ink} y={yOf(i)} face={i === STACK.length - 1} />
              </m.g>
            ))}
            {state === "sent" && (
              <m.g
                initial={animate ? { y: -20, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={animate ? { y: { type: "spring", stiffness: 520, damping: 15 }, opacity: { duration: 0.1 } } : { duration: 0 }}
              >
                <Chip ink="sky" y={yOf(STACK.length)} face />
              </m.g>
            )}
          </svg>
        </m.span>
      )}
    </AnimatePresence>
  );
}
