/**
 * Small pieces the deck's cards and the case study dialog share.
 */

import { morphId } from "../../motion/morph";

/**
 * The shared layoutId of a case study's picture. The face of its card in
 * the deck and the dialog's figure carry it, so opening a case study grows
 * the card into the head of the dialog, and closing shrinks it back.
 */
export const figureId = (slug: string) => `${morphId(slug)}-figure`;

/**
 * The figure's corners: rounded on top, where it is the edge of its card or
 * of the dialog (r-lg less the 1px border it sits inside), square below.
 * In style rather than CSS, so Motion can correct them while the figure is
 * scaled during the morph.
 */
export const FIGURE_RADIUS = {
  borderTopLeftRadius: 19,
  borderTopRightRadius: 19,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
} as const;

/** The card-to-dialog morph (SPEC.md, section 4): firm, no overshoot on text. */
export const MORPH_SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;

/** The plain fade that stands in for the morph: reduced motion, paused, or no card to grow from. */
export const FADE = { duration: 0.16, ease: [0.16, 1, 0.3, 1] } as const;

/**
 * Whether a status describes work still going on. Every finished project's
 * status starts "Completed" ("Completed", "Completed and deployed"); anything
 * else ("In active development", "Pipeline built; ...") is still moving.
 */
export function isOngoing(status: string | null | undefined): boolean {
  return Boolean(status) && !/^completed/i.test(status as string);
}

