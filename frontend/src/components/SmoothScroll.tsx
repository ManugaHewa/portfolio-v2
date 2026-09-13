import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerLenis } from "../lib/scrollLock";

gsap.registerPlugin(ScrollTrigger);

// Clears the sticky header when an in-page link lands on a section.
const HEADER_OFFSET = -76;

// Lenis smooths native scroll input (it still drives real window.scrollY, no
// virtual wrapper) so every scroll-linked effect elsewhere in the app
// (useScroll, IntersectionObserver, the progress bar) keeps working as-is.
//
// It runs off gsap.ticker rather than its own requestAnimationFrame: with
// autoRaf:false there is exactly ONE rAF loop on the page, so Lenis and the
// Hero's ScrollTrigger scrub can't tear against each other by reading and
// writing scroll position in two different frames.
//
// Skipped entirely under reduced motion: smoothing/inertia on every scroll
// is exactly the kind of ambient motion that preference asks us to drop.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      autoRaf: false,
      // Lenis takes over in-page anchor clicks. Without this the nav jumps
      // instantly while everything else on the page glides, which reads as a
      // bug rather than as speed.
      anchors: { offset: HEADER_OFFSET },
    });

    registerLenis(lenis);

    const update = () => ScrollTrigger.update();
    lenis.on("scroll", update);

    // gsap.ticker reports seconds; Lenis wants milliseconds.
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    // Lag smoothing would let GSAP skip time after a slow frame, which shows
    // up as the pinned hero jumping ahead of the scroll position.
    gsap.ticker.lagSmoothing(0);

    return () => {
      registerLenis(null);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33); // GSAP's default
      lenis.off("scroll", update);
      lenis.destroy();
    };
  }, []);

  return null;
}
