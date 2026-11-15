import { memo } from "react";
import { m, useScroll } from "./m";
import { useHydrated } from "./hooks";

/**
 * 2px ember hairline on the header's top edge: how much of the page is
 * read. aria-hidden; rendered only after hydration (without JS it would be
 * wrong). Follows the scroll directly, so reduced motion needs no change.
 */
export const ScrollProgress = memo(function ScrollProgress() {
  const hydrated = useHydrated();
  const { scrollYProgress } = useScroll();
  if (!hydrated) return null;
  return <m.div className="scroll-progress" aria-hidden="true" style={{ scaleX: scrollYProgress }} />;
});
