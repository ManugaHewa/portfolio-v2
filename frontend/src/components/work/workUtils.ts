/** Pieces shared by the deck's cards and the case study dialog. */

import { morphId } from "../../motion/morph";
import { EASE_OUT } from "../../motion/ease";

/** Shared layoutId of a case study's figure: the card face grows into the dialog's head and back. */
export const figureId = (slug: string) => `${morphId(slug)}-figure`;

/**
 * Figure corners: rounded on top (r-lg minus the 1px border), square below.
 * Inline, so Motion can correct them while the figure scales.
 */
export const FIGURE_RADIUS = {
  borderTopLeftRadius: 19,
  borderTopRightRadius: 19,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
} as const;

/** Card-to-dialog morph: firm, no overshoot. */
export const MORPH_SPRING = { type: "spring", stiffness: 320, damping: 34 } as const;

/** The fade used instead of the morph (reduced motion, paused, or no card). */
export const FADE = { duration: 0.16, ease: EASE_OUT };

/** Whether a status means ongoing work; finished ones start "Completed". */
export function isOngoing(status: string | null | undefined): boolean {
  return Boolean(status) && !/^completed/i.test(status as string);
}

