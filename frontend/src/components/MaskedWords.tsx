import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Props {
  text: string;
  className?: string;
  /** Seconds before the first word moves. */
  delay?: number;
  /** Seconds between consecutive words. */
  stagger?: number;
}

/**
 * Splits a line into words and rises each one out from behind a mask, rather
 * than fading the whole block at once. Split by word, not by character: a
 * headline this size reads as a sentence, and per-letter animation turns it
 * into an effect you watch instead of words you read.
 *
 * Each word keeps its own overflow-hidden wrapper, so the mask edge follows
 * the text wherever the line happens to break at that viewport width. The
 * spaces sit outside the wrappers so real word spacing and wrapping survive.
 */
export function MaskedWords({ text, className = "", delay = 0, stagger = 0.045 }: Props) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  if (reduceMotion) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {words.map((word, i) => (
        // The space is a sibling of the wrapper, not a child of it. Inside an
        // inline-block it would remove the break opportunity between words and
        // the headline could no longer wrap.
        <Fragment key={`${word}-${i}`}>
          <span className="mask-word">
            <motion.span
              className="mask-word-inner"
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{
                duration: 0.75,
                delay: delay + i * stagger,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
