import type Lenis from "lenis";

/**
 * Lenis drives scrolling from its own wheel and touch handlers, so setting
 * `body { overflow: hidden }` alone does not reliably stop the page moving
 * behind a dialog. SmoothScroll registers its instance here, and anything
 * that opens an overlay locks through this module so both the native and the
 * smoothed path are held at once.
 *
 * Reduced motion never constructs a Lenis, so `instance` stays null and the
 * overflow lock is the whole story. That is the correct behaviour, not a gap.
 */
let instance: Lenis | null = null;
let locks = 0;
let restoreOverflow = "";

export function registerLenis(lenis: Lenis | null) {
  instance = lenis;
}

export function lockScroll() {
  // Counted rather than boolean: if two overlays were ever open at once,
  // closing the first must not unlock the page underneath the second.
  locks += 1;
  if (locks > 1) return;
  restoreOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  instance?.stop();
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;
  document.body.style.overflow = restoreOverflow;
  instance?.start();
}
