/**
 * Holds the page still behind the dialog. With Lenis gone the browser does
 * all the scrolling, so hiding overflow on <html> is the whole lock. <html>
 * rather than <body>: overflow set on body is passed up to the viewport only
 * while html's own is visible, which made the body version easy to defeat.
 * base.css gives html `scrollbar-gutter: stable`, so the page does not shift
 * sideways when its scrollbar goes away.
 */
let locks = 0;
let restoreOverflow = "";

export function lockScroll() {
  // Counted rather than boolean: if two overlays were ever open at once,
  // closing the first must not unlock the page underneath the second.
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

/**
 * Left only so the old SmoothScroll.tsx, no longer imported anywhere, still
 * compiles until it is deleted. Does nothing.
 */
export function registerLenis(_lenis: unknown) {}
