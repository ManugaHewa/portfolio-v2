import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { deviceCanRunScene, useSceneEnabled } from "../lib/useSceneEnabled";
import {
  APPROACH_MARGIN,
  MAX_PIXEL_RATIO,
  SMALL_OR_TOUCH_QUERY,
  sceneAllowed,
  sceneBudget,
  scaled,
} from "../lib/sceneQuality";
import type { SceneBudget, SceneVariant } from "../lib/sceneQuality";
import { mountScene } from "../lib/threeScene";
import { Scene, failSoft } from "../components/Scene";
import { MotionPauseContext } from "../motion/hooks";

/*
 * jsdom has no WebGL, so Three's renderer is replaced with a recorder: the
 * point of these tests is when the harness draws, not what it draws.
 */
const three = vi.hoisted(() => ({ renderers: [] as Array<{ render: { mock: { calls: unknown[] } } }> }));

vi.mock("three", () => {
  class WebGLRenderer {
    domElement = document.createElement("canvas");
    render = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    constructor(public params: unknown) {
      three.renderers.push(this);
    }
  }
  class Scene {}
  class PerspectiveCamera {
    aspect = 1;
    constructor(public fov: number) {}
    updateProjectionMatrix() {}
  }
  return { WebGLRenderer, Scene, PerspectiveCamera };
});

// The real Scene3D would need Three's geometry; the gate only needs to know
// whether it was mounted, with what, and when it goes away.
vi.mock("../components/Scene3D", () => ({
  default: ({ variant, paused }: { variant: string; paused?: boolean }) => (
    <div data-testid="scene3d" data-variant={variant} data-paused={String(Boolean(paused))} />
  ),
}));

const realMatchMedia = window.matchMedia;
const realDpr = window.devicePixelRatio;
const realIO = window.IntersectionObserver;

/**
 * A matchMedia that answers each query from a predicate, so a test can describe
 * a device ("a phone that prefers motion") rather than a single boolean.
 */
function stubMatchMedia(matcher: (query: string) => boolean) {
  const listeners = new Map<string, Set<() => void>>();

  window.matchMedia = ((query: string) => ({
    get matches() {
      return matcher(query);
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, cb: () => void) => {
      const forQuery = listeners.get(query) ?? new Set<() => void>();
      forQuery.add(cb);
      listeners.set(query, forQuery);
    },
    removeEventListener: (_: string, cb: () => void) => {
      listeners.get(query)?.delete(cb);
    },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  return {
    fire: () => listeners.forEach((set) => set.forEach((cb) => cb())),
    count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
}

function setDpr(value: number) {
  Object.defineProperty(window, "devicePixelRatio", { value, configurable: true });
}

/** An IntersectionObserver the test drives by hand. */
class ManualIO {
  static all: ManualIO[] = [];
  targets: Element[] = [];
  constructor(
    public cb: IntersectionObserverCallback,
    public options: IntersectionObserverInit = {}
  ) {
    ManualIO.all.push(this);
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.targets = [];
  }
  takeRecords() {
    return [];
  }
  /** Reports every observed element as in (or out of) this observer's zone. */
  fire(isIntersecting: boolean) {
    const entries = this.targets.map(
      (target) => ({ target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }) as IntersectionObserverEntry
    );
    if (entries.length) this.cb(entries, this as unknown as IntersectionObserver);
  }
}

const MOTION_OK = "(prefers-reduced-motion: no-preference)";
const SMALL_OR_TOUCH = SMALL_OR_TOUCH_QUERY;

/** A phone: touch, narrow, motion allowed. */
const phone = (q: string) =>
  q === MOTION_OK || q === SMALL_OR_TOUCH || q.includes("719.98px") || q.includes("1099.98px");
/** A desktop with a mouse, motion allowed. */
const desktop = (q: string) => q === MOTION_OK;
/** A desktop whose owner asked for less motion. */
const reduced = (q: string) => q === "(prefers-reduced-motion: reduce)";

const SECTION: SceneVariant[] = ["field", "corridor", "globe", "signal"];
const ALWAYS: SceneVariant[] = ["core", "starfield"];

function Probe({ variant }: { variant?: SceneVariant }) {
  return <span data-testid="enabled">{String(useSceneEnabled(variant))}</span>;
}
const readout = () => screen.getByTestId("enabled").textContent;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  window.IntersectionObserver = realIO;
  ManualIO.all = [];
  setDpr(realDpr);
});

describe("which scenes run on which device", () => {
  it("runs all six on a desktop that allows motion", () => {
    stubMatchMedia(desktop);
    for (const v of [...ALWAYS, ...SECTION]) {
      const { unmount } = render(<Probe variant={v} />);
      expect(readout(), v).toBe("true");
      unmount();
    }
  });

  it("runs only the gyroscope and the starfield on a phone or a touch screen", () => {
    stubMatchMedia(phone);
    for (const v of ALWAYS) {
      const { unmount } = render(<Probe variant={v} />);
      expect(readout(), v).toBe("true");
      unmount();
    }
    for (const v of SECTION) {
      const { unmount } = render(<Probe variant={v} />);
      expect(readout(), v).toBe("false");
      unmount();
    }
    expect(SECTION.every((v) => !sceneAllowed(v, true))).toBe(true);
    expect(ALWAYS.every((v) => sceneAllowed(v, true))).toBe(true);
  });

  it("runs none of them for reduced motion", () => {
    stubMatchMedia(reduced);
    for (const v of [...ALWAYS, ...SECTION]) {
      const { unmount } = render(<Probe variant={v} />);
      expect(readout(), v).toBe("false");
      unmount();
    }
  });

  it("reacts to the preference changing rather than deciding once at mount", async () => {
    let motionOk = true;
    const mq = stubMatchMedia((q) => (q === MOTION_OK ? motionOk : false));
    render(<Probe />);
    expect(readout()).toBe("true");

    motionOk = false;
    await act(async () => mq.fire());
    expect(readout()).toBe("false");
  });

  it("drops a section scene when the window narrows past 720px", async () => {
    let narrow = false;
    const mq = stubMatchMedia((q) => q === MOTION_OK || (q === SMALL_OR_TOUCH && narrow));
    render(<Probe variant="globe" />);
    expect(readout()).toBe("true");

    narrow = true;
    await act(async () => mq.fire());
    expect(readout()).toBe("false");
  });

  it("detaches its listeners on unmount", () => {
    const mq = stubMatchMedia(desktop);
    const { unmount } = render(<Probe />);
    expect(mq.count()).toBeGreaterThan(0);
    unmount();
    expect(mq.count()).toBe(0);
  });
});

describe("the render budget", () => {
  it("never draws above 1.5x, however dense the screen", () => {
    stubMatchMedia(phone);
    setDpr(3);
    expect(sceneBudget("core").pixelRatio).toBe(MAX_PIXEL_RATIO);

    stubMatchMedia(desktop);
    setDpr(2);
    for (const v of ["core", ...SECTION] as SceneVariant[]) {
      expect(sceneBudget(v).pixelRatio, v).toBe(1.5);
    }
  });

  it("draws the starfield at ratio 1 and 30 frames a second", () => {
    stubMatchMedia(desktop);
    setDpr(2);
    expect(sceneBudget("starfield")).toMatchObject({ pixelRatio: 1, maxFps: 30 });
    expect(sceneBudget("core").maxFps).toBe(0);
  });

  it("never asks for a higher ratio than the screen actually has", () => {
    stubMatchMedia(desktop);
    setDpr(1);
    expect(sceneBudget().pixelRatio).toBe(1);
  });

  it("spends less geometry on a phone than on a desktop", () => {
    stubMatchMedia(phone);
    const small = sceneBudget();
    stubMatchMedia(desktop);
    const large = sceneBudget();
    expect(small.detail).toBeLessThan(large.detail);
    expect(small.antialias).toBe(false);
    expect(large.antialias).toBe(true);
  });

  it("keeps a shape readable rather than scaling it into nothing", () => {
    // A ring with three segments is a triangle and a scatter with two points is
    // not a scatter, so every count carries its own floor.
    expect(scaled(96, 0.45, 48)).toBe(48);
    expect(scaled(160, 0.45, 70)).toBe(72);
    expect(scaled(160, 1, 70)).toBe(160);
  });
});

describe("mounting a section scene on approach", () => {
  beforeEach(() => {
    window.IntersectionObserver = ManualIO as unknown as typeof IntersectionObserver;
  });

  it("builds it within half a viewport of the screen and drops it once it leaves", async () => {
    stubMatchMedia(desktop);
    const { container } = render(<Scene variant="field" className="scene-layer scene-field" />);

    // The host exists to be watched; the scene itself waits.
    expect(container.querySelector(".scene-3d.scene-layer.scene-field")).not.toBeNull();
    expect(screen.queryByTestId("scene3d")).toBeNull();

    const io = ManualIO.all.find((o) => o.options.rootMargin === APPROACH_MARGIN);
    if (!io) throw new Error("no observer watching the approach zone");
    expect(APPROACH_MARGIN).toBe("50% 0px");

    await act(async () => io.fire(true));
    expect(await screen.findByTestId("scene3d")).toHaveAttribute("data-variant", "field");

    await act(async () => io.fire(false));
    expect(screen.queryByTestId("scene3d")).toBeNull();
  });

  it("mounts the gyroscope and the starfield straight away", async () => {
    stubMatchMedia(desktop);
    render(
      <>
        <Scene variant="core" />
        <Scene variant="starfield" />
      </>
    );
    const scenes = await screen.findAllByTestId("scene3d");
    expect(scenes.map((s) => s.dataset.variant).sort()).toEqual(["core", "starfield"]);
    expect(ManualIO.all.some((o) => o.options.rootMargin === APPROACH_MARGIN)).toBe(false);
  });

  it("renders nothing at all for a section scene on a phone", () => {
    stubMatchMedia(phone);
    const { container } = render(<Scene variant="corridor" className="scene-layer scene-corridor" />);
    expect(container.innerHTML).toBe("");
  });

  it("passes the visitor's pause through without remounting", async () => {
    stubMatchMedia(desktop);
    const setPaused = () => {};
    const { rerender } = render(
      <MotionPauseContext.Provider value={{ paused: false, setPaused }}>
        <Scene variant="core" />
      </MotionPauseContext.Provider>
    );
    const first = await screen.findByTestId("scene3d");
    expect(first).toHaveAttribute("data-paused", "false");

    rerender(
      <MotionPauseContext.Provider value={{ paused: true, setPaused }}>
        <Scene variant="core" />
      </MotionPauseContext.Provider>
    );
    const second = screen.getByTestId("scene3d");
    expect(second).toHaveAttribute("data-paused", "true");
    expect(second).toBe(first);
  });

  it("renders nothing and reports the scene dead when its chunk fails to load", async () => {
    // A tab left open across a deploy asks for a chunk that no longer exists.
    const { default: Fallback } = await failSoft(() => Promise.reject(new Error("404")));
    const onLive = vi.fn();
    const { container } = render(<Fallback variant="field" onLive={onLive} />);
    expect(container.innerHTML).toBe("");
    expect(onLive).toHaveBeenCalledWith(false);
  });
});

describe("the render loop", () => {
  let clock = 0;
  let nextId = 0;
  let pending = new Map<number, FrameRequestCallback>();
  let visibility: DocumentVisibilityState = "visible";

  /** Runs one display frame, `ms` after the last. */
  const frame = (ms = 1000 / 60) => {
    clock += ms;
    const due = [...pending.values()];
    pending = new Map();
    due.forEach((cb) => cb(clock));
  };
  const renders = () => three.renderers[three.renderers.length - 1].render.mock.calls.length;

  const budget = (over: Partial<SceneBudget> = {}) => () => ({
    pixelRatio: 1.5,
    detail: 1,
    antialias: true,
    maxFps: 0,
    ...over,
  });

  beforeEach(() => {
    stubMatchMedia(desktop);
    window.IntersectionObserver = ManualIO as unknown as typeof IntersectionObserver;
    three.renderers.length = 0;
    clock = 0;
    pending = new Map();
    visibility = "visible";
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      pending.set(++nextId, cb);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // Back to jsdom's own getter on the prototype.
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });

  const mount = (opts: Parameters<typeof mountScene>[2] = {}) => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const update = vi.fn();
    const c = mountScene(el, { setup: () => update }, { budget: budget(), ...opts });
    const io = ManualIO.all[ManualIO.all.length - 1];
    return { el, c, io, update };
  };

  it("draws one resting frame at mount and reports the scene live", () => {
    const onLive = vi.fn();
    mount({ onLive });
    expect(renders()).toBe(1);
    expect(onLive).toHaveBeenCalledWith(true);
  });

  it("runs only while on screen", () => {
    const { io } = mount();
    frame();
    expect(renders()).toBe(1);

    io.fire(true);
    frame();
    frame();
    expect(renders()).toBe(3);

    io.fire(false);
    frame();
    expect(renders()).toBe(3);
  });

  it("stops while the tab is hidden", () => {
    const { io } = mount();
    io.fire(true);
    frame();
    const before = renders();

    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    frame();
    frame();
    expect(renders()).toBe(before);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    frame();
    expect(renders()).toBe(before + 1);
  });

  it("pauses and resumes on the visitor's say-so without rebuilding", () => {
    const { io, c } = mount();
    io.fire(true);
    frame();
    const before = renders();

    c.setPaused(true);
    frame();
    frame();
    expect(renders()).toBe(before);

    c.setPaused(false);
    frame();
    expect(renders()).toBe(before + 1);
    // Still the one renderer: nothing was torn down and rebuilt.
    expect(three.renderers).toHaveLength(1);
  });

  it("starts paused when motion is already paused, showing its resting frame", () => {
    const { io } = mount({ paused: true });
    io.fire(true);
    frame();
    frame();
    expect(renders()).toBe(1);
  });

  it("caps the starfield's loop at 30 frames a second", () => {
    const { io } = mount({ budget: budget({ maxFps: 30 }) });
    io.fire(true);
    for (let i = 0; i < 60; i++) frame();
    // One second of 60Hz display frames: the resting frame plus about 30.
    expect(renders()).toBeGreaterThanOrEqual(29);
    expect(renders()).toBeLessThanOrEqual(32);
  });

  it("applies the budget's pixel ratio", () => {
    mount({ budget: budget({ pixelRatio: 1 }) });
    const r = three.renderers[0] as unknown as { setPixelRatio: { mock: { calls: number[][] } } };
    expect(r.setPixelRatio.mock.calls[0][0]).toBe(1);
  });

  it("hides the canvas and reports the scene dead when the context is lost", () => {
    const onLive = vi.fn();
    const { el, io } = mount({ onLive });
    io.fire(true);
    frame();
    const canvas = el.querySelector("canvas");
    if (!canvas) throw new Error("no canvas mounted");

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(onLive).toHaveBeenLastCalledWith(false);
    expect(canvas.style.visibility).toBe("hidden");

    // Lost is final: coming back on screen must not restart the loop on it.
    const before = renders();
    io.fire(false);
    io.fire(true);
    frame();
    expect(renders()).toBe(before);
  });

  it("removes its canvas and stops on dispose", () => {
    const { el, io, c } = mount();
    io.fire(true);
    c.dispose();
    const before = renders();
    frame();
    expect(renders()).toBe(before);
    expect(el.querySelector("canvas")).toBeNull();
  });

  it("does not touch WebGL at all for reduced motion", () => {
    stubMatchMedia(reduced);
    mount();
    expect(three.renderers).toHaveLength(0);
  });
});

describe("what counts as too weak for the scene", () => {
  const nav = (hints: Record<string, unknown>) => hints as unknown as Navigator;

  it("runs it when the browser reports nothing either way", () => {
    expect(deviceCanRunScene(nav({}))).toBe(true);
  });

  it("skips it with data saver on", () => {
    expect(deviceCanRunScene(nav({ connection: { saveData: true } }))).toBe(false);
  });

  it("skips it on two gigabytes of memory or less", () => {
    expect(deviceCanRunScene(nav({ deviceMemory: 2, hardwareConcurrency: 8 }))).toBe(false);
    expect(deviceCanRunScene(nav({ deviceMemory: 4, hardwareConcurrency: 8 }))).toBe(true);
  });

  it("skips it on two cores or fewer", () => {
    expect(deviceCanRunScene(nav({ hardwareConcurrency: 2 }))).toBe(false);
    expect(deviceCanRunScene(nav({ hardwareConcurrency: 4 }))).toBe(true);
  });
});
