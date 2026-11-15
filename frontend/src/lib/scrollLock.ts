/**
 * Locks page scroll behind the dialog by hiding overflow on <html> (body's
 * overflow only reaches the viewport while html's is visible). base.css sets
 * `scrollbar-gutter: stable`, so the page does not shift.
 */
let locks = 0;
let restoreOverflow = "";

export function lockScroll() {
  // Counted, so closing one of two overlays keeps the page locked.
  locks += 1;
  if (locks > 1) return;
  const html = document.documentElement;
  restoreOverflow = html.style.overflow;
  html.style.overflow = "hidden";
}

export function unlockScroll() {
  if (locks === 0) return;
  locks -= 1;
  if (locks > 0) return;
  document.documentElement.style.overflow = restoreOverflow;
}
