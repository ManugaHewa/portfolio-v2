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
 * A WebGL backdrop, or nothing at all on a device that should not be asked to
 * run one. Returning before `Scene3D` is ever referenced is the point: that is
 * what keeps the Three chunk off the wire on a phone rather than merely idle.
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
