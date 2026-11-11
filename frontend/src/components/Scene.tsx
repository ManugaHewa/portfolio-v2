import { lazy, Suspense, useContext, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { MotionPauseContext } from "../motion/hooks";
import { cx } from "../lib/cx";
import { useSceneEnabled } from "../lib/useSceneEnabled";
import { APPROACH_MARGIN, mountsOnApproach } from "../lib/sceneQuality";
import type { SceneVariant } from "../lib/sceneQuality";
import type { Scene3DProps } from "./Scene3D";

export type { SceneVariant };

/** What a scene renders when its chunk could not be fetched: nothing. */
function SceneUnavailable({ onLive }: Scene3DProps) {
  // The hero keeps (or brings back) its still.
  useEffect(() => {
    onLive?.(false);
  }, [onLive]);
  return null;
}

/**
 * Loads the scene module, failing soft. There is no error boundary on the
 * page, so a rejected lazy import would take the whole root down with it, and
 * a section scene's chunk is fetched only when its section comes near, which
 * can be long after load: a tab left open across a deploy asks for a hashed
 * file the deploy has since deleted. A failed fetch leaves the CSS layer and
 * the hero's still where they are instead.
 */
export function failSoft(
  load: () => Promise<{ default: ComponentType<Scene3DProps> }>
): Promise<{ default: ComponentType<Scene3DProps> }> {
  return load().catch(() => ({ default: SceneUnavailable }));
}

/**
 * One lazy import for the whole site, declared here instead of separately in
 * each section that wants a backdrop. It is one chunk either way, but this
 * way it is also one place that decides whether to load it at all.
 */
const Scene3D = lazy(() => failSoft(() => import("./Scene3D")));

export interface SceneProps {
  variant: SceneVariant;
  /** Placement classes from styles/scenes.css: scene-layer or scene-sticky, plus scene-<variant>. */
  className?: string;
  /** True once the first frame is drawn; false when the scene goes away or its context is lost. */
  onLive?: (live: boolean) => void;
}

/**
 * A WebGL backdrop, when the device and the visitor's settings allow one
 * (useSceneEnabled).
 *
 * The host element is rendered here, before Three has loaded, so it can be
 * watched: a section scene is only built once its host comes within half a
 * viewport of the screen, and is torn down again when it leaves that zone.
 * That also keeps the Three chunk off the wire until the first scene is
 * actually wanted. The hero's gyroscope and the starfield are on screen from
 * the start and mount straight away.
 *
 * The header's "Pause motion" toggle reaches the scene as a prop, which stops
 * its render loop on the frame it is showing without rebuilding anything.
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

  // Nothing on the server or during hydration (useSceneEnabled is false
  // until then), so the prerendered HTML carries no empty scene boxes.
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
