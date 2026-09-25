import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useSceneEnabled } from "../lib/useSceneEnabled";
import { sceneBudget, scaled } from "../lib/sceneQuality";

const realMatchMedia = window.matchMedia;
const realDpr = window.devicePixelRatio;

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

const MOTION_OK = "(prefers-reduced-motion: no-preference)";
const phone = (q: string) => (q === MOTION_OK ? true : q.includes("760px") || q.includes("1100px"));
const desktop = (q: string) => q === MOTION_OK;

function Probe() {
  return <span data-testid="enabled">{String(useSceneEnabled())}</span>;
}
const readout = () => screen.getByTestId("enabled").textContent;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  setDpr(realDpr);
});

describe("whether the scenes run at all", () => {
  it("runs them on a phone", () => {
    // They used to be switched off below 900px, which left a phone looking at a
    // flat page. Screen size is a budget question now, not an on/off one.
    stubMatchMedia(phone);
    render(<Probe />);
    expect(readout()).toBe("true");
  });

  it("switches them off only for reduced motion", () => {
    stubMatchMedia(() => false);
    render(<Probe />);
    expect(readout()).toBe("false");
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

  it("detaches its listener on unmount", () => {
    const mq = stubMatchMedia(desktop);
    const { unmount } = render(<Probe />);
    expect(mq.count()).toBe(1);
    unmount();
    expect(mq.count()).toBe(0);
  });
});

describe("the render budget", () => {
  it("spends far less on a phone than on a desktop", () => {
    stubMatchMedia(phone);
    setDpr(3);
    const small = sceneBudget();

    stubMatchMedia(desktop);
    setDpr(2);
    const large = sceneBudget();

    // Pixel ratio is the lever that matters: a phone reporting DPR 3 would
    // otherwise render a 400px canvas into a 1200px buffer, six times over.
    expect(small.pixelRatio).toBeLessThan(large.pixelRatio);
    expect(small.detail).toBeLessThan(large.detail);
    expect(small.antialias).toBe(false);
    expect(large.antialias).toBe(true);
  });

  it("tears scenes down between sections on a phone but not on a desktop", () => {
    // Six live GPU contexts is enough for mobile Safari to start dropping them,
    // and a dropped context is a backdrop that silently vanishes.
    stubMatchMedia(phone);
    expect(sceneBudget().mountOnApproach).toBe(true);

    stubMatchMedia(desktop);
    expect(sceneBudget().mountOnApproach).toBe(false);
  });

  it("never asks for a higher ratio than the screen actually has", () => {
    stubMatchMedia(desktop);
    setDpr(1);
    expect(sceneBudget().pixelRatio).toBe(1);
  });

  it("keeps a shape readable rather than scaling it into nothing", () => {
    // A ring with three segments is a triangle and a scatter with two points is
    // not a scatter, so every count carries its own floor.
    expect(scaled(96, 0.45, 48)).toBe(48);
    expect(scaled(160, 0.45, 70)).toBe(72);
    expect(scaled(160, 1, 70)).toBe(160);
  });
});
