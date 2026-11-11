import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { sceneBudget } from "./sceneQuality";
import type { SceneBudget } from "./sceneQuality";

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

export interface MountOptions {
  /** Hears true once the first frame is drawn, false if the context is lost. */
  onLive?: (live: boolean) => void;
  /**
   * Pixel ratio, antialiasing and frame-rate cap. A function rather than a
   * value because it is read again on every resize: rotating a phone across
   * a breakpoint should change the budget, not keep the one from mount. It is
   * read at mount and on resize only, never per frame: each read asks
   * matchMedia, and nothing it depends on changes between resizes.
   */
  budget?: () => SceneBudget;
  /** Start with the loop stopped (the visitor has paused motion). */
  paused?: boolean;
}

/**
 * What a mounted scene gives back. Pausing is separate from disposing so the
 * header's "Pause motion" toggle can stop every loop and start it again
 * without throwing away and rebuilding six GPU contexts.
 */
export interface SceneController {
  setPaused(paused: boolean): void;
  dispose(): void;
}

const INERT: SceneController = { setPaused: () => {}, dispose: () => {} };

/**
 * Shared harness for every WebGL scene on the page.
 *
 * Written once because the same things go wrong in each of them:
 *
 * - Backing store vs CSS size. The renderer's drawing buffer has to match
 *   the element's real box times the pixel ratio, or the canvas is silently
 *   upscaled and everything looks soft.
 * - Resize. A canvas sized once at mount is wrong the moment the layout
 *   moves, so this watches the element rather than the window.
 * - Idle cost. A loop below the fold, in a background tab or after the
 *   visitor pressed "Pause motion" is pure battery drain, so the loop runs
 *   only while all three allow it.
 * - Disposal. Three holds GPU buffers until told otherwise; without an
 *   explicit teardown a StrictMode remount leaks a context every time.
 *
 * `onLive` hears true once the first frame is drawn and false if the context
 * is later lost. The hero shows a still image whenever its scene is not live,
 * so a device that never gets a frame out keeps the still instead of an
 * empty box.
 */
export function mountScene(el: HTMLElement, def: SceneDef, options: MountOptions = {}): SceneController {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return INERT;
  }

  const { onLive } = options;
  const budget = options.budget ?? (() => sceneBudget());
  // The budget as last read: at mount, then again by applySize on each resize.
  let current = budget();

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      alpha: true,
      antialias: current.antialias,
      powerPreference: "low-power",
    });
  } catch {
    // No WebGL: the CSS layer underneath is the whole experience.
    return INERT;
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(def.fov ?? 42, 1, 0.1, 100);

  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  el.appendChild(canvas);

  const applySize = () => {
    // clientWidth/Height, not getBoundingClientRect: the rect is the
    // *transformed* box, and the hero's gyroscope is scaled as the work
    // index rises over it. Measuring the rect would size the buffer to the
    // shrunken box and leave the scene soft when it grows back.
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    current = budget();
    renderer.setPixelRatio(current.pixelRatio);
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
  let drawn = false;
  let t = 0;
  let lastFrame = performance.now();

  const draw = () => {
    renderer.render(scene, camera);
    if (!drawn) {
      drawn = true;
      onLive?.(true);
    }
  };

  const tick = (now: number) => {
    if (!running) return;
    // A frame-rate cap skips display frames rather than using a timer, so the
    // frames that are drawn stay in step with the display. The millisecond of
    // slack keeps a 60Hz display from landing just short of every other frame.
    const cap = current.maxFps;
    if (cap > 0 && now - lastFrame < 1000 / cap - 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    t += dt;
    update?.(t, dt);
    draw();
    raf = requestAnimationFrame(tick);
  };

  // Independent reasons to stop, so none of them can restart the loop while
  // another still wants it stopped. Intersection alone is not enough: the
  // page-wide starfield is position: fixed, so it never stops intersecting.
  let onScreen = false;
  let visible = document.visibilityState !== "hidden";
  let paused = options.paused ?? false;
  // Terminal, unlike the others: a lost context is never coming back here, so
  // scrolling the element back into view must not restart the loop on it. A
  // section scene gets a fresh context the next time its section approaches.
  let lost = false;
  let disposed = false;

  const sync = () => {
    const shouldRun = onScreen && visible && !paused && !lost && !disposed;
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

  // One frame straight away, at time zero, before any loop starts. A scene
  // that mounts while motion is paused then shows its resting pose rather
  // than an empty canvas, and the hero can swap its still for it.
  update?.(0, 0);
  draw();

  const io = new IntersectionObserver(
    (entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
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
    if (lost || disposed) return;
    handle.size = applySize();
    // Repaint immediately rather than waiting for the next frame: while the
    // loop is stopped, nothing else would redraw the resized buffer.
    renderer.render(scene, camera);
  });
  ro.observe(el);

  // A lost context would otherwise leave a dead black canvas on the page.
  // Hiding it lets whatever sits underneath (the hero's still image, or just
  // the section's background) show, and onLive(false) tells the hero to
  // bring its still back.
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    sync();
    canvas.style.visibility = "hidden";
    onLive?.(false);
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    setPaused(next: boolean) {
      paused = next;
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      def.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
