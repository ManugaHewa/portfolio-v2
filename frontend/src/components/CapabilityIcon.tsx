import { motion, useReducedMotion } from "framer-motion";

export type CapabilityIconId =
  | "layers"
  | "shield"
  | "ship"
  | "cursor"
  | "database"
  | "lock";

// Single-stroke line art on a 24x24 grid, inheriting currentColor so each card
// tints its own glyph. Kept as paths rather than an icon dependency: six icons
// is not worth a package, and these stay consistent with the stroke weight of
// the rest of the interface.
const PATHS: Record<CapabilityIconId, string[]> = {
  layers: ["M12 2 2 7l10 5 10-5-10-5Z", "m2 12 10 5 10-5", "m2 17 10 5 10-5"],
  shield: ["M12 3 5 6v6c0 4.2 3 7.4 7 8.4 4-1 7-4.2 7-8.4V6l-7-3Z", "m9 11.8 2.2 2.2L15.5 10"],
  ship: ["M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z", "M3 7.5 12 12l9-4.5", "M12 12v9"],
  cursor: ["m4 3 7 17 2.6-6.6L20 11 4 3Z"],
  database: [
    "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z",
    "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6",
    "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  ],
  lock: ["M7 10V7a5 5 0 0 1 10 0v3", "M4.5 10h15v10.5h-15z"],
};

/**
 * The glyph draws itself the first time its card scrolls into view: each
 * stroke runs from nothing to its full length, one after the next, the way
 * you would draw it by hand.
 *
 * pathLength is the right tool rather than a hand-computed stroke-dasharray,
 * because it normalises every path to 0..1 regardless of its real length, so
 * a one-stroke glyph and a three-stroke glyph take the same time.
 */
export function CapabilityIcon({ id }: { id: CapabilityIconId }) {
  const reduceMotion = useReducedMotion();
  const paths = PATHS[id];

  return (
    <motion.svg
      className="capability-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      initial={reduceMotion ? false : "hidden"}
      whileInView="drawn"
      viewport={{ once: true, amount: 0.6 }}
    >
      {paths.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          variants={{
            hidden: { pathLength: 0, opacity: 0 },
            drawn: {
              pathLength: 1,
              opacity: 1,
              transition: {
                pathLength: { duration: 0.65, delay: 0.15 + i * 0.22, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.01, delay: 0.15 + i * 0.22 },
              },
            },
          }}
        />
      ))}
    </motion.svg>
  );
}
