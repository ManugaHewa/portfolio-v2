import { m, useScroll } from "./m";
import { useHydrated } from "./hooks";

/**
 * A 2px ember hairline along the header's top edge, as long as the share of
 * the page read. Decoration only (aria-hidden). Nothing is rendered until the
 * page has hydrated: without JavaScript nothing would move it, and a bar
 * stuck at full or zero width says something untrue.
 *
 * scaleX follows the scroll position directly, frame by frame, with no easing
 * of its own, so it is not an animation reduced motion needs to stop.
 */
export function ScrollProgress() {
  const hydrated = useHydrated();
  const { scrollYProgress } = useScroll();
  if (!hydrated) return null;
  return <m.div className="scroll-progress" aria-hidden="true" style={{ scaleX: scrollYProgress }} />;
}
