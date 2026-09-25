import { useEffect, useRef, useState } from "react";

// Order matches the page: the work comes first, then the supporting material.
const LINKS = [
  { href: "#projects", label: "Work" },
  { href: "#skills", label: "Skills" },
  { href: "#contact", label: "Contact" },
];

export function Nav() {
  const [active, setActive] = useState("#projects");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);

      // A line a third of the way down the viewport decides the active
      // section. getBoundingClientRect rather than offsetTop, because the
      // pinned hero sits inside a GSAP pin-spacer and offsetTop is measured
      // against an offsetParent that the pin can change.
      const line = window.innerHeight * 0.34;
      let current = LINKS[0].href;

      for (const link of LINKS) {
        const el = document.querySelector(link.href);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = link.href;
      }

      // At the very bottom the last section may never cross the line, so
      // make sure the final link still lights up when the page bottoms out.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atBottom ? LINKS[LINKS.length - 1].href : current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // The mobile menu is an overlay, so it should close the way overlays do:
  // on Escape, and on a click that lands outside it.
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
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <nav className="nav" ref={navRef} aria-label="Primary">
        <a className="brand" href="#top" aria-label="Home">
          <span className="brand-mark">MH</span>
          <span className="brand-text">Manuga Hewa Pathirana</span>
        </a>

        <button
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="navLinks"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>

        <div className={`nav-links${open ? " is-open" : ""}`} id="navLinks">
          {LINKS.map((l) => (
            <a
              key={l.href}
              className={`nav-link${active === l.href ? " is-active" : ""}`}
              href={l.href}
              aria-current={active === l.href ? "true" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
