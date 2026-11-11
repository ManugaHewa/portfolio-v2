/**
 * Small pieces the case cards, the other-work rows and the dialog share.
 */

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

/**
 * A stack as one line: the first `max` names, then "+N" for the rest, so a
 * long stack cannot push a card's footer around.
 */
export function stackLine(stack: string[], max: number): string {
  const shown = stack.slice(0, max).join(" · ");
  return stack.length > max ? `${shown} +${stack.length - max}` : shown;
}
