import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { MaskedWords } from "./MaskedWords";

import { ScrollTrigger } from "gsap/ScrollTrigger";
// Lazy, and skipped outright on a small screen: see Scene.tsx. The CSS scope
// below renders immediately and stays underneath, so the hero never waits on
// WebGL and still looks finished when the chunk never arrives.
import { Scene } from "./Scene";

gsap.registerPlugin(ScrollTrigger);

// Matches --transition / the framer easing used elsewhere in the app.
const EASE = "power3.out";

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // gsap.context scopes every selector below to this element and gives us a
    // single revert() that kills the tweens, the ScrollTriggers and the pin
    // spacer, and restores the inline styles, so StrictMode's double-mount
    // and HMR can't leave a second pinned copy behind.
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          // Pinning only makes sense while the hero actually fits the
          // viewport; on a phone (or a short window) the frame is taller than
          // the screen and pinning would strand its bottom off-screen.
          roomToPin: "(min-width: 769px) and (min-height: 640px)",
        },
        (context) => {
          const { motion, roomToPin } = context.conditions as {
            motion: boolean;
            roomToPin: boolean;
          };

          // Reduced motion: do nothing at all. Every tween below is a .from()
          // or .to() off the hero's natural state, so running none of them
          // leaves a static, fully-visible hero with no pin and no scrub.
          if (!motion) return;

          const lines = gsap.utils.toArray<HTMLElement>(".hero-stagger");
          // The headline rises word by word from its own mask (MaskedWords),
          // so it is excluded here or the two entrances fight over opacity.
          // It stays in `lines` for the scrubbed departure further down.
          const introLines = gsap.utils.toArray<HTMLElement>(
            ".hero-stagger:not(.hero-title)"
          );

          // One-shot entrance, not scroll-linked: the hero has to be readable
          // at first paint, before the user has scrolled anything.
          const intro = gsap
            .timeline({ defaults: { ease: EASE, duration: 0.7 } })
            .from(introLines, { opacity: 0, y: 18, filter: "blur(6px)", stagger: 0.09 })
            .from(
              ".hero-visual",
              { opacity: 0, y: 24, filter: "blur(8px)", duration: 0.8 },
              0.25
            );

          // Drift with a slight roll rather than a straight bob: a pure
          // vertical float is the most generic loop there is, and at 14px it
          // was barely readable as motion at all.
          gsap.to(".hero-photo", {
            y: -22,
            rotate: 1.4,
            duration: 5,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          });

          if (!roomToPin) return;

          // The one beat: the section holds still while the copy hands itself
          // off bottom-up, the frame settles back, and the three orbs drift at
          // their own rates. Then the pin releases and the page scrolls on.
          gsap
            .timeline({
              scrollTrigger: {
                trigger: root,
                start: "top top",
                end: "+=62%",
                pin: true,
                // Direct scrub, no smoothing lag: Lenis already smooths the
                // scroll position feeding this.
                scrub: true,
                anticipatePin: 1,
                onUpdate: () => {
                  // If the user scrolls while the entrance is still playing,
                  // finish it instantly rather than letting both timelines
                  // write opacity/y on the same nodes.
                  if (intro.isActive()) intro.progress(1);
                },
              },
            })
            .to(".scroll-cue", { opacity: 0, duration: 0.15 }, 0)
            .to(".hero-frame", { scale: 0.94, duration: 1 }, 0)
            .to(".grid", { opacity: 0.12, yPercent: -8, duration: 1 }, 0)
            .to(".orb-a", { yPercent: -22, duration: 1 }, 0)
            .to(".orb-b", { yPercent: -12, duration: 1 }, 0)
            .to(".orb-c", { yPercent: -34, duration: 1 }, 0)
            .to(
              [...lines].reverse(),
              {
                opacity: 0,
                y: -40,
                filter: "blur(6px)",
                stagger: 0.12,
                duration: 0.5,
              },
              0.05
            )
            .to(".hero-visual", { opacity: 0, y: -60, duration: 0.6 }, 0.15);
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section className="hero" id="top" ref={rootRef}>
      <div className="hero-bg" aria-hidden="true">
        <div className="grid" />
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="orb orb-c" />
      </div>

      <div className="container hero-inner">
        <div className="hero-frame">
          <div className="hero-copy">
            <p className="kicker hero-stagger">
              Software Engineering graduate · full-stack developer
            </p>
            <h1 className="hero-title hero-stagger">
              {/* The site's own thesis in its own words: portfolio_projects.txt
                  argues that the strongest entries "show real clients, real
                  infrastructure and real engineering decisions". Both halves
                  are load-bearing and both are checkable further down the page
                  - a real industry client on the capstone, and a server this
                  site is actually deployed on. The line it replaced spent a
                  whole sentence claiming what the work below already proves. */}
              <MaskedWords text="Real clients, real infrastructure." delay={0.15} />
            </h1>
            <p className="hero-subtitle hero-stagger">Manuga Hewa Pathirana</p>
            <div className="hero-actions hero-stagger">
              <a className="btn btn-primary" href="#projects">
                See the work
              </a>
              <a className="btn" href="#contact">
                Get in touch
              </a>
            </div>
            <div className="hero-meta hero-stagger">
              <a
                className="chip"
                href="https://github.com/ManugaHewa"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a
                className="chip"
                href="https://www.linkedin.com/in/manugahewa"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
              <span className="chip chip-muted">Milton, ON</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-photo">
              <Scene variant="core" className="scene-core" />
            </div>
          </div>
        </div>
      </div>

      <div className="scroll-cue" aria-hidden="true">
        <span className="scroll-cue-dot" />
        <span>Scroll</span>
      </div>
    </section>
  );
}
