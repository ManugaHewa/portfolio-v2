import { Fragment } from "react";
import type { CSSProperties } from "react";
import { cx } from "../lib/cx";

export interface HeroNameProps {
  id?: string;
  text: string;
  className?: string;
}

/**
 * The page's h1. Each word rises from a mask with CSS keyframes alone
 * (motion.css), so the name animates before any JavaScript has loaded and
 * the largest paint is not held back by it. --i is each word's place in the
 * 70ms stagger.
 *
 * Nothing here hides the name in the HTML: the keyframes only run under
 * prefers-reduced-motion: no-preference, and their end state is the
 * element's own, so without CSS animation the name simply sits in place.
 * No data-reveal for the same reason.
 */
export function HeroName({ id, text, className }: HeroNameProps) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <h1 id={id} className={cx("hero-name", className)}>
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="hero-name-mask">
            <span className="hero-name-word" style={{ "--i": i } as CSSProperties}>
              {word}
            </span>
          </span>
        </Fragment>
      ))}
    </h1>
  );
}
