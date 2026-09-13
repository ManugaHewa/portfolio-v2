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
