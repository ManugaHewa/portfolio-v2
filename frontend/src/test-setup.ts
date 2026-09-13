import "@testing-library/jest-dom/vitest";

// jsdom ships no matchMedia. Anything that checks prefers-reduced-motion
// (Hero, SmoothScroll) or uses gsap.matchMedia needs it to exist. Reports
// "no match", i.e. the no-preference / desktop-less default.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Also absent from jsdom, and needed by framer-motion's whileInView (Reveal)
// and by the skills graph's visibility gate. This stub reports the target as
// immediately intersecting, so reveal-on-scroll content is present in tests
// instead of being stuck at opacity 0 forever.
if (!window.IntersectionObserver) {
  class StubIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(private readonly cb: IntersectionObserverCallback) {}

    observe(target: Element) {
      this.cb(
        [{ isIntersecting: true, target, intersectionRatio: 1 } as IntersectionObserverEntry],
        this
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver =
    StubIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Lenis constructs a ResizeObserver on init, and jsdom has none, so rendering
// anything containing <SmoothScroll /> (that is, the whole App) threw. A stub
// that never fires is correct here: nothing resizes in a test.
if (!window.ResizeObserver) {
  class StubResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
}

// jsdom ships no PointerEvent either, so fireEvent.pointerMove falls back to a
// bare Event and the handler sees no coordinates at all. MouseEvent does exist
// and already carries clientX/clientY, so deriving from it gives pointer
// handlers something real to read.
if (!window.PointerEvent) {
  class StubPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
    }
  }
  window.PointerEvent = StubPointerEvent as unknown as typeof PointerEvent;
}

// jsdom has no canvas backend and logs a loud "Not implemented" error every
// time getContext is called. SkillsGraph already treats a null context as
// "this environment cannot draw, skip the render loop", which is the correct
// behaviour here, so return null quietly and keep real failures visible.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
