import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useSceneEnabled } from "../lib/useSceneEnabled";

const realMatchMedia = window.matchMedia;

/** A matchMedia whose answer we control, plus a handle to flip it. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  };
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;

  return {
    set(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb());
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function Probe() {
  return <span data-testid="enabled">{String(useSceneEnabled())}</span>;
}

const readout = () => screen.getByTestId("enabled").textContent;

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe("the WebGL capability gate", () => {
  it("runs the scenes when the device matches", () => {
    stubMatchMedia(true);
    render(<Probe />);
    expect(readout()).toBe("true");
  });

  it("skips them when it does not", () => {
    // The whole point of the gate: six WebGL contexts and a 133 kB gzipped
    // Three chunk never reach a phone, and every scene has a CSS layer
    // underneath that is already the immediate paint.
    stubMatchMedia(false);
    render(<Probe />);
    expect(readout()).toBe("false");
  });

  it("reacts to a viewport change rather than deciding once at mount", async () => {
    // Rotating a tablet or dragging a desktop window narrow has to take
    // effect; a one-off width read at mount would stick forever.
    const mq = stubMatchMedia(true);
    render(<Probe />);
    expect(readout()).toBe("true");

    await act(async () => mq.set(false));
    expect(readout()).toBe("false");
  });

  it("detaches its listener on unmount", () => {
    const mq = stubMatchMedia(true);
    const { unmount } = render(<Probe />);
    expect(mq.listenerCount).toBe(1);

    unmount();
    expect(mq.listenerCount).toBe(0);
  });
});
