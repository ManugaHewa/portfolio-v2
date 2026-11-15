import { lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { MotionPauseContext } from "../motion/hooks";
import { cx } from "../lib/cx";
import { useSceneEnabled } from "../lib/useSceneEnabled";
import { APPROACH_MARGIN, mountsOnApproach } from "../lib/sceneQuality";
import type { SceneVariant } from "../lib/sceneQuality";
import type { Scene3DProps } from "./Scene3D";

export type { SceneVariant };

/** Rendered when the scene chunk fails to load: nothing. */
function SceneUnavailable({ onLive }: Scene3DProps) {
  // The hero keeps (or restores) its still.
  useEffect(() => {
    onLive?.(false);
  }, [onLive]);
  return null;
}

/**
 * Loads the scene module, failing soft: there is no error boundary, and a
 * tab open across a deploy can ask for a chunk that no longer exists.
 */
export function failSoft(
  load: () => Promise<{ default: ComponentType<Scene3DProps> }>
): Promise<{ default: ComponentType<Scene3DProps> }> {
  return load().catch(() => ({ default: SceneUnavailable }));
}

/** The one lazy import for every scene, so one place decides whether to load it. */
const Scene3D = lazy(() => failSoft(() => import("./Scene3D")));

export interface SceneProps {
  variant: SceneVariant;
  /** Placement classes from styles/scenes.css. */
  className?: string;
  /** true after the first frame; false when the scene goes or its context is lost. */
  onLive?: (live: boolean) => void;
}

/**
 * A WebGL backdrop, when allowed (useSceneEnabled). The host renders before
 * Three loads, so section scenes are built only within half a viewport and
 * torn down after; the Three chunk loads when first needed. "Pause motion"
 * stops the loop without rebuilding.
 */
export function Scene({ variant, className, onLive }: SceneProps) {
  const enabled = useSceneEnabled(variant);
  const { paused } = useContext(MotionPauseContext);
  const hostRef = useRef<HTMLDivElement>(null);
  const approach = mountsOnApproach(variant);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setNear(false);
      return;
    }
    if (!approach || typeof IntersectionObserver !== "function") {
      setNear(true);
      return;
    }
    const el = hostRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => setNear(entries[entries.length - 1].isIntersecting),
      { rootMargin: APPROACH_MARGIN }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, approach]);

  // Nothing on the server or while hydrating, so the HTML has no empty boxes.
  if (!enabled) return null;

  return (
    <div ref={hostRef} className={cx("scene-3d", className)} aria-hidden="true">
      {near && (
        <Suspense fallback={null}>
          <Scene3D variant={variant} paused={paused} onLive={onLive} />
        </Suspense>
      )}
    </div>
  );
}
