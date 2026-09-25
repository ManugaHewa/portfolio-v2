import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { sceneBudget } from "./sceneQuality";

export interface SceneHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** Longest edge of the drawing surface in CSS pixels. */
  size: number;
}

export interface SceneDef {
  /** Build the contents. Return a per-frame update, or nothing. */
  setup: (h: SceneHandle) => ((t: number, dt: number) => void) | void;
  /** Field of view, default 42. */
  fov?: number;
  /** Everything created in setup that holds GPU memory. */
  dispose?: () => void;
}

/**
 * Shared harness for every WebGL scene on the page.
 *
 * Written once because the same four things go wrong in each of them:
 *
 * - Backing store vs CSS size. The renderer's drawing buffer has to match
 *   the element's real box times the device pixel ratio, or the canvas is
 *   silently upscaled and everything looks soft. The first version of the
 *   hero dome rendered 383px into a 392px box for exactly this reason.
 * - Resize. A canvas sized once at mount is wrong the moment the layout
 *   moves, so this watches the element rather than the window.
 * - Offscreen cost. A WebGL loop that keeps running below the fold is pure
 *   battery drain, so the frame loop is gated on intersection.
 * - Disposal. Three holds GPU buffers until told otherwise; without an
 *   explicit teardown a StrictMode remount leaks a context every time.
 */
export function mountScene(el: HTMLElement, def: SceneDef): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return () => {};
  }

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      alpha: true,
      // Off on small screens. MSAA costs real fill rate on a mobile GPU and
      // these scenes are soft, additive-blended backdrops at half opacity, so
      // it buys almost nothing visible.
      antialias: sceneBudget().antialias,
      powerPreference: "low-power",
    });
  } catch {
    // No WebGL: the CSS layer underneath is the whole experience.
    return () => {};
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(def.fov ?? 42, 1, 0.1, 100);

  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  el.appendChild(renderer.domElement);

  const applySize = () => {
    // clientWidth/Height, not getBoundingClientRect: the rect is the
    // *transformed* box, and these canvases sit inside cards that GSAP is
    // rotating and scaling. Measuring the rect made the hero dome render a
    // 383px buffer into a 392px box, which is why it looked soft.
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    // Re-read the budget on every resize, so rotating a phone into landscape
    // and crossing the breakpoint changes the ratio rather than keeping
    // whichever one happened to apply at mount. A phone reporting DPR 3 would
    // otherwise render a 400px canvas into a 1200px buffer, six times over.
    renderer.setPixelRatio(sceneBudget().pixelRatio);
    // updateStyle false: the element is already sized by CSS, and letting
    // three write inline px here is what desyncs buffer from box.
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return Math.max(w, h);
  };

  const handle: SceneHandle = { scene, camera, renderer, size: applySize() };
  const update = def.setup(handle);

  let raf = 0;
  let running = false;
  let t = 0;
  let lastFrame = performance.now();

  const tick = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    t += dt;
    update?.(t, dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  // Two independent reasons to stop, so neither can restart the loop while the
  // other still wants it paused. Intersection alone was not enough: the
  // page-wide starfield is position: fixed, so it never stops intersecting and
  // its loop ran forever, including in a background tab.
  let onScreen = false;
  let visible = document.visibilityState !== "hidden";
  // Terminal, unlike the other two: a lost context is never coming back here,
  // so scrolling the element back into view must not restart the loop on it.
  let lost = false;

  const sync = () => {
    const shouldRun = onScreen && visible && !lost;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      // Without this the first frame after a pause sees the whole paused
      // duration as its delta and the scene jumps forward.
      lastFrame = performance.now();
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    },
    { threshold: 0.02 }
  );
  io.observe(el);

  const onVisibility = () => {
    visible = document.visibilityState !== "hidden";
    sync();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const ro = new ResizeObserver(() => {
    if (lost) return;
    handle.size = applySize();
    // Repaint immediately rather than waiting for the next frame: while the
    // loop is paused offscreen, nothing else would redraw the resized buffer.
    renderer.render(scene, camera);
  });
  ro.observe(el);

  // A lost context would otherwise leave a dead black canvas on the page.
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    sync();
    renderer.domElement.style.opacity = "0";
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  return () => {
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    running = false;
    cancelAnimationFrame(raf);
    renderer.domElement.removeEventListener("webglcontextlost", onLost);
    def.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
