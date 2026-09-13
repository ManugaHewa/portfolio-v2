import { useEffect, useState } from "react";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#skills", label: "Skills" },
  { href: "#projects", label: "Projects" },
  { href: "#contact", label: "Contact" },
];

export function Nav() {
  const [active, setActive] = useState("#about");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);

      const y = window.scrollY + window.innerHeight * 0.35;

      // Sort by actual live position instead of a hardcoded order, so a
      // nested/adjacent section can't hijack the "active" state the way
      // it did in the static-site version.
      const sections = LINKS.map((l) => document.querySelector(l.href))
        .filter((el): el is HTMLElement => el !== null)
        .sort((a, b) => a.offsetTop - b.offsetTop);

      let current = sections[0]?.id;
      for (const s of sections) {
        if (s.offsetTop <= y) current = s.id;
      }
      if (current) setActive(`#${current}`);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <nav className="nav">
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
          Menu
        </button>

        <div className={`nav-links${open ? " is-open" : ""}`} id="navLinks">
          {LINKS.map((l) => (
            <a
              key={l.href}
              className={`nav-link${active === l.href ? " is-active" : ""}`}
              href={l.href}
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
