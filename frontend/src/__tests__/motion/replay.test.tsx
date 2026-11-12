import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReplayInView } from "../../motion";

/**
 * An IntersectionObserver the test drives by hand: `report` sends one entry
 * for the observed element, placed where the test says.
 */
let callback: IntersectionObserverCallback | null = null;
const original = window.IntersectionObserver;

class ManualObserver {
  constructor(cb: IntersectionObserverCallback) {
    callback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const VIEW = { top: 0, bottom: 800, height: 800 };

function report(intersecting: boolean, ratio: number, top: number, height = 200) {
  act(() => {
    callback?.(
      [
        {
          isIntersecting: intersecting,
          intersectionRatio: ratio,
          boundingClientRect: { top, height, bottom: top + height },
          rootBounds: VIEW,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useReplayInView(ref, 0.2);
  return (
    <div ref={ref} data-testid="probe">
      {shown ? "shown" : "hidden"}
    </div>
  );
}

beforeEach(() => {
  window.IntersectionObserver = ManualObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  window.IntersectionObserver = original;
  callback = null;
});

describe("useReplayInView", () => {
  it("plays on the way down, every time, and never hides on the way up", () => {
    const { getByTestId } = render(<Probe />);
    const state = () => getByTestId("probe").textContent;
    expect(state()).toBe("hidden");

    // Scrolled down to it.
    report(true, 0.5, 600);
    expect(state()).toBe("shown");

    // Scrolled on past it: it leaves through the top and stays as it is.
    report(false, 0, -300);
    expect(state()).toBe("shown");

    // Back up through it, then above it: it leaves through the bottom and
    // re-arms out of sight.
    report(true, 1, 300);
    expect(state()).toBe("shown");
    report(false, 0, 900);
    expect(state()).toBe("hidden");

    // The next scroll down plays it again.
    report(true, 0.4, 650);
    expect(state()).toBe("shown");
  });

  it("waits for the share of the element it was asked for", () => {
    const { getByTestId } = render(<Probe />);
    report(true, 0.05, 780);
    expect(getByTestId("probe").textContent).toBe("hidden");
    report(true, 0.25, 700);
    expect(getByTestId("probe").textContent).toBe("shown");
  });
});
