import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { sceneBudget } from "./sceneQuality";
import type { SceneBudget } from "./sceneQuality";

export interface SceneHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  /** Longest edge of the canvas in CSS px. */
  size: number;
}

export interface SceneDef {
  /** Builds the contents; may return a per-frame update. */
  setup: (h: SceneHandle) => ((t: number, dt: number) => void) | void;
  /** Field of view (default 42). */
  fov?: number;
  /** Frees what setup put on the GPU. */
  dispose?: () => void;
}

export interface MountOptions {
  /** true after the first frame; false if the context is lost. */
  onLive?: (live: boolean) => void;
  /** Pixel ratio, antialiasing and frame cap. Read at mount and on resize, never per frame. */
  budget?: () => SceneBudget;
  /** Start paused (the visitor paused motion). */
  paused?: boolean;
}

/** Pausing is separate from disposing, so "Pause motion" never rebuilds contexts. */
export interface SceneController {
  setPaused(paused: boolean): void;
  dispose(): void;
}

/** Collects GPU resources for a one-call teardown. */
export function makeTracker() {
  const bag: Array<{ dispose: () => void }> = [];
  return {
    bag,
    track<T extends { dispose: () => void }>(x: T): T {
      bag.push(x);
      return x;
    },
    disposeAll() {
      bag.forEach((d) => d.dispose());
      bag.length = 0;
    },
  };
}

const INERT: SceneController = { setPaused: () => {}, dispose: () => {} };

/**
 * Shared WebGL harness: sizes the drawing buffer to the element's box,
 * follows resizes, runs the loop only while on screen, visible and not
 * paused, and frees GPU memory on dispose. Via `onLive`, the hero keeps its
 * still image until a frame is drawn, and gets it back if the context is lost.
 */
export function mountScene(el: HTMLElement, def: SceneDef, options: MountOptions = {}): SceneController {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return INERT;
  }

  const { onLive } = options;
  const budget = options.budget ?? (() => sceneBudget());
  // Budget as last read (mount, then each resize).
  let current = budget();

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      alpha: true,
      antialias: current.antialias,
      powerPreference: "low-power",
    });
  } catch {
    // No WebGL: the CSS underneath stands in.
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
    // clientWidth/Height, not the transformed rect: the hero wheel scales
    // while it docks, and a rect-sized buffer would stay soft.
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    current = budget();
    renderer.setPixelRatio(current.pixelRatio);
    // updateStyle false: CSS sizes the element; inline px would desync it.
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
    // Cap by skipping display frames, so drawn frames stay in step with the
    // display. The 1 ms slack stops a 60 Hz display missing every other one.
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

  // Separate stop reasons, so none restarts the loop while another holds it.
  // The fixed starfield always intersects, so intersection alone is not enough.
  let onScreen = false;
  let visible = document.visibilityState !== "hidden";
  let paused = options.paused ?? false;
  // Final: a section scene gets a new context when its section next approaches.
  let lost = false;
  let disposed = false;

  const sync = () => {
    const shouldRun = onScreen && visible && !paused && !lost && !disposed;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      // Or the first frame after a pause jumps by the paused time.
      lastFrame = performance.now();
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
    }
  };

  // One frame at t = 0 first, so a paused scene shows its resting pose.
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
    // Redraw now: a stopped loop would leave the resized buffer blank.
    renderer.render(scene, camera);
  });
  ro.observe(el);

  // Hide a lost context's dead canvas so what is underneath shows.
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
