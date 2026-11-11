import { useEffect, useRef, useState } from "react";

interface Props {
  email: string;
  className?: string;
}

// How long the button says "Copied" before it goes back to "Copy".
const CONFIRM_MS = 2200;

type Result = "idle" | "copied" | "selected";

const MESSAGES: Record<Result, string> = {
  idle: "",
  copied: "Email address copied",
  selected: "Email address selected, ready to copy",
};

/**
 * The email address as a mailto link, with a Copy button beside it for
 * anyone whose browser has no mail client set up (most work laptops).
 *
 * The confirmation happens in place, on the button itself, and is said once
 * in a polite live region that is always in the DOM: a region added at the
 * moment it changes is often missed by screen readers. Where the clipboard
 * API is missing or refused (an insecure origin, an old browser, a denied
 * permission), the address is selected instead, so Ctrl+C is one key away.
 */
export function CopyEmail({ email, className }: Props) {
  const [result, setResult] = useState<Result>("idle");
  const addressRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = (next: Result) => {
    window.clearTimeout(timer.current);
    setResult(next);
    timer.current = window.setTimeout(() => setResult("idle"), CONFIRM_MS);
  };

  const selectAddress = () => {
    const node = addressRef.current;
    const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
    if (node && selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.addRange(range);
    }
    settle("selected");
  };

  const copy = async () => {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      selectAddress();
      return;
    }
    try {
      await clipboard.writeText(email);
      settle("copied");
    } catch {
      selectAddress();
    }
  };

  const copied = result === "copied";

  return (
    <span className={className ? `copy-email ${className}` : "copy-email"}>
      <a ref={addressRef} className="copy-email-address" href={`mailto:${email}`}>
        {email}
      </a>
      <button
        type="button"
        className="copy-email-btn mono"
        data-state={result}
        onClick={copy}
      >
        <span className="copy-email-icon" aria-hidden="true">
          {copied ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path className="copy-email-check" d="M3.5 8.5 6.5 11.5 12.5 4.5" pathLength={1} />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
            </svg>
          )}
        </span>
        {/* The visible word starts the accessible name, so voice control
            users can say what they see (WCAG 2.5.3). */}
        <span className="copy-email-label">{copied ? "Copied" : "Copy"}</span>
        <span className="visually-hidden"> email address</span>
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {MESSAGES[result]}
      </span>
    </span>
  );
}
