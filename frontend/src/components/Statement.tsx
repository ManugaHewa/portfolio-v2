import { useRef } from "react";
import { useMotionAllowed } from "../motion";
import { m, useScroll, useTransform } from "../motion/m";
import type { MotionValue } from "../motion/m";

/**
 * The statement between the work and "How it's built". DRAFT copy, waiting
 * for the owner's approval: every claim in it is one the pipeline section
 * below shows with the file that makes it true.
 */
export const STATEMENT =
  "Everything on this page runs on code I wrote and a server I host. The project list starts in one TypeScript file, goes through a Postgres database and an Express API, and is written into the page at build time too, with a test in CI that checks the two agree. Here is how that fits together.";

// The two ends of a word's colour: the quiet control ink (4.4:1 on the
// page, enough for text this large) and the full text colour.
const DIM = "#6b8088";
const LIT = "#e7eaeb";

/**
 * One paragraph that reads itself in as the visitor scrolls: each word goes
 * from the quiet ink to the full text colour as the scroll passes it, so
 * the eye is walked through the sentence at the speed of the scroll. It is
 * tied to the scroll position, so scrolling back unreads it and the next
 * pass reads it again.
 *
 * The prerendered paragraph is plain text at full colour, and stays that way
 * without JavaScript, under reduced motion and while motion is paused. Only
 * the colour changes, never the layout, so nothing reflows.
 */
export function Statement({ text = STATEMENT }: { text?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const allowed = useMotionAllowed();
  // From the paragraph's top entering the lower part of the screen to its
  // bottom passing the upper middle.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <section className="section statement" aria-label="How this site is built, in short">
      <div className="container">
        <p className="statement-text" ref={ref}>
          {allowed
            ? words.map((w, i) => (
                <Word key={i} progress={scrollYProgress} from={i / words.length} to={(i + 1) / words.length}>
                  {i > 0 ? ` ${w}` : w}
                </Word>
              ))
            : text}
        </p>
      </div>
    </section>
  );
}

interface WordProps {
  progress: MotionValue<number>;
  from: number;
  to: number;
  children: string;
}

function Word({ progress, from, to, children }: WordProps) {
  const color = useTransform(progress, [from, to], [DIM, LIT]);
  return <m.span style={{ color }}>{children}</m.span>;
}
