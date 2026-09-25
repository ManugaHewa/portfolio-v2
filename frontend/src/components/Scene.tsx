import { lazy, Suspense } from "react";
import type { SceneVariant } from "./Scene3D";
import { useSceneEnabled } from "../lib/useSceneEnabled";

/**
 * One lazy import for the whole site, declared here instead of separately in
 * each of the five sections that wants a backdrop. Five `lazy()` calls pointed
 * at the same module is one chunk either way, but it was also five places to
 * remember when the decision about whether to load it at all changed.
 */
const Scene3D = lazy(() => import("./Scene3D"));

/**
 * A WebGL backdrop, unless the viewer has asked for less motion.
 *
 * Screen size is not a factor here any more. How hard a scene works on a small
 * screen is decided inside Scene3D from sceneQuality.ts, which also handles
 * building and tearing scenes down as their sections approach on a phone.
 */
export function Scene({ variant, className }: { variant: SceneVariant; className?: string }) {
  const enabled = useSceneEnabled();
  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <Scene3D variant={variant} className={className} />
    </Suspense>
  );
}
