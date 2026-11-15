import { useEffect, useRef, useState } from "react";
import { PauseMotionToggle, useActiveSection } from "../motion";
import { SITE } from "../site";
import { cx } from "../lib/cx";
import { WheelMark } from "./WheelMark";

/** The page's four sections, in order; shared by the nav and the index rail. */
export const PAGE_SECTIONS = [
  { id: "work-index", label: "Work" },
  { id: "pipeline", label: "How it's built" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

const SPY_IDS = PAGE_SECTIONS.map((s) => s.id);

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const active = useActiveSection(SPY_IDS);

  // Hairline under the header once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The phone menu closes like an overlay: on Escape or an outside click.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className={cx("site-header", scrolled && "is-scrolled")}>
      <nav className="site-nav container" ref={navRef} aria-label="Primary">
        {/* Named by its visible text, for voice control. */}
        <a className="brand" href="#top">
          {/* The hero wheel docks here (Hero.tsx); hidden via --dock-mark until then. */}
          <WheelMark className="brand-mark" />
          {SITE.name}
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-panel"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>

        <div className={cx("nav-panel", open && "is-open")} id="nav-panel">
          <ul className="nav-links">
            {PAGE_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  className={cx("nav-link", active === s.id && "is-active")}
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "location" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {/* Rolls to a copy of itself on hover (chrome.css); the copy has empty alt text. */}
                  <span className="nav-roll">
                    <span className="nav-roll-text" data-text={s.label}>
                      {s.label}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <PauseMotionToggle />
        </div>
      </nav>
    </header>
  );
}
