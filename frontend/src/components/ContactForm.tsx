import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "../motion/m";
import type { Variants } from "../motion/m";
import { EASE_OUT, Magnetic, Scramble, useIsomorphicLayoutEffect, useMotionAllowed } from "../motion";
import { api } from "../api";
import { cx } from "../lib/cx";
import { SendTrace } from "./SendTrace";
import { ChipStack } from "./ChipStack";
import { signalSend } from "../lib/sendSignal";
import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";
import { RETENTION, SITE } from "../site";

// Reason phrases for the contact route's status codes.
const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  413: "Payload Too Large",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

type Status = "idle" | "sending" | "sent" | "error";

// Mirrors the API's Zod schema (backend/src/routes/contact.ts), for inline errors without a round trip.
export const LIMITS = { name: 120, message: 2000, messageMin: 10 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The counter is announced only when crossing these, never per keystroke.
const COUNT_THRESHOLDS = [200, 50] as const;

interface Fields {
  name: string;
  email: string;
  message: string;
}

const EMPTY: Fields = { name: "", email: "", message: "" };

function validate(values: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};

  if (!values.name.trim()) errors.name = "Please tell me who you are.";
  else if (values.name.length > LIMITS.name) errors.name = `Keep this under ${LIMITS.name} characters.`;

  if (!values.email.trim()) errors.email = "I need an address to reply to.";
  else if (!EMAIL.test(values.email)) errors.email = "That does not look like a valid email address.";

  const message = values.message.trim();
  if (message.length < LIMITS.messageMin) {
    errors.message = `A little more detail please, at least ${LIMITS.messageMin} characters.`;
  } else if (values.message.length > LIMITS.message) {
    errors.message = `Keep this under ${LIMITS.message} characters.`;
  }

  return errors;
}

/** Threshold bucket for a remaining count: "over", 50, 200, or null. */
export function countBucket(remaining: number): "over" | 50 | 200 | null {
  if (remaining < 0) return "over";
  for (const t of [...COUNT_THRESHOLDS].reverse()) if (remaining <= t) return t;
  return null;
}

function countMessage(remaining: number): string {
  if (remaining < 0) {
    const over = -remaining;
    return `${over} ${over === 1 ? "character" : "characters"} over the limit`;
  }
  return `${remaining} ${remaining === 1 ? "character" : "characters"} left`;
}

const SPRING_SWAP = { type: "spring", stiffness: 460, damping: 30, mass: 0.55 } as const;

const LETTER: Variants = {
  in: { y: "105%", opacity: 0 },
  show: (i: number) => ({ y: "0%", opacity: 1, transition: { ...SPRING_SWAP, delay: i * 0.025 } }),
  out: (i: number) => ({
    y: "-105%",
    opacity: 0,
    transition: { duration: 0.16, ease: EASE_OUT, delay: i * 0.0125 },
  }),
};

const LETTER_INSTANT: Variants = {
  in: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  out: { opacity: 0, transition: { duration: 0 } },
};

const letters = (text: string) =>
  [...text].map((c, i) => (
    <span key={i} className="submit-letter">
      {c}
    </span>
  ));

/**
 * Submit label: the old word rolls out letter by letter, the new one rolls
 * in, and the width springs between them. Width comes from a hidden copy
 * set letter by letter (a kerned word measures narrower). Not announced
 * here; SendTrace's status region speaks.
 */
// Memoised: the form re-renders on every keystroke, the label only on a state change.
const SubmitLabel = memo(function SubmitLabel({ label }: { label: string }) {
  const animate = useMotionAllowed();
  const ghost = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (ghost.current) setWidth(ghost.current.offsetWidth);
  }, [label]);

  const variants = animate ? LETTER : LETTER_INSTANT;

  return (
    <m.span
      className="submit-label"
      initial={false}
      animate={width === null ? undefined : { width }}
      transition={animate ? SPRING_SWAP : { duration: 0 }}
    >
      <span ref={ghost} className="submit-label-ghost" aria-hidden="true">
        {letters(label)}
      </span>
      <AnimatePresence initial={false}>
        <m.span key={label} className="submit-label-live" aria-hidden="true" initial="in" animate="show" exit="out">
          {[...label].map((c, i) => (
            <m.span key={i} className="submit-letter" custom={i} variants={variants}>
              {c}
            </m.span>
          ))}
        </m.span>
      </AnimatePresence>
      <span className="visually-hidden">{label}</span>
    </m.span>
  );
});

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  // HTTP status of the last send.
  const [httpCode, setHttpCode] = useState<number | null>(null);
  const [values, setValues] = useState<Fields>(EMPTY);
  // Errors show once a field is left or a submit is tried.
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  // Send trace hop in flight; -1 when idle. From 2 the API has answered, so the button says "Sent".
  const [stage, setStage] = useState(-1);
  const delivered = stage >= 2;
  // Honeypot value, kept out of `values`.
  const [website, setWebsite] = useState("");
  // The API drops sends made within seconds of this.
  const shownAt = useRef(Date.now());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped to remount the widget: one token per send.
  const [turnstileRound, setTurnstileRound] = useState(0);
  const [turnstileMissing, setTurnstileMissing] = useState(false);
  // Counter announcement, set on threshold crossings.
  const [countNote, setCountNote] = useState("");
  const lastBucket = useRef<ReturnType<typeof countBucket>>(null);

  const motionAllowed = useMotionAllowed();
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Form height at send; the success view keeps it as a minimum so the page doesn't jump.
  const [sentHeight, setSentHeight] = useState<number | null>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  // Focus target after a view swap: success heading, or the name field on "Send another".
  const focusNext = useRef<"success" | "name" | null>(null);

  const errors = validate(values);
  const showError = (field: keyof Fields) =>
    (touched[field] || submitted) && errors[field] ? errors[field] : null;

  const remaining = LIMITS.message - values.message.length;
  const sending = status === "sending";

  useEffect(() => {
    const bucket = countBucket(remaining);
    if (bucket !== lastBucket.current) {
      // Announced on the way down only, not while deleting.
      const worse =
        bucket !== null &&
        (lastBucket.current === null ||
          bucket === "over" ||
          (lastBucket.current !== "over" && bucket < lastBucket.current));
      setCountNote(worse ? countMessage(remaining) : "");
      lastBucket.current = bucket;
    }
  }, [remaining]);

  useEffect(() => {
    if (focusNext.current === "success" && status === "sent") successRef.current?.focus();
    if (focusNext.current === "name" && status === "idle") nameRef.current?.focus();
    focusNext.current = null;
  }, [status]);

  const set = (field: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const blur = (field: keyof Fields) => () =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // aria-disabled keeps focus while sending, so repeat presses are ignored here.
    if (sending) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      // Focus the first invalid field.
      const first = (["name", "email", "message"] as const).find((f) => errors[f]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setTurnstileMissing(true);
      return;
    }
    setTurnstileMissing(false);

    setStatus("sending");
    setHttpCode(null);
    // The contact scene launches its packet (lib/sendSignal.ts).
    signalSend({ kind: "launch" });
    // Validation has passed, so the first step shows as done.
    setStage(0);
    try {
      // Advance to the network hop next frame, so the first segment draws
      // even on a fast answer; only from 0, never stepping back.
      requestAnimationFrame(() => setStage((s) => (s === 0 ? 1 : s)));
      const token = turnstileToken;
      if (TURNSTILE_SITE_KEY) {
        // This send spends the token; get a new one now.
        setTurnstileToken(null);
        setTurnstileRound((round) => round + 1);
      }
      const answer = await api.sendContactMessage({
        ...values,
        website,
        elapsedMs: Date.now() - shownAt.current,
        ...(token ? { turnstileToken: token } : {}),
      });
      // Answered means parsed and stored; walk the last two hops before the success view.
      const code = answer.httpStatus ?? null;
      setHttpCode(code);
      signalSend({ kind: "land", ok: true, code });
      setStage(2);
      await new Promise((r) => setTimeout(r, 260));
      setStage(3);
      await new Promise((r) => setTimeout(r, 380));
      focusNext.current = "success";
      setSentHeight(formRef.current?.offsetHeight ?? null);
      setStatus("sent");
      setStage(-1);
      setValues(EMPTY);
      setTouched({});
      setSubmitted(false);
    } catch (err) {
      // api.ts's HttpError carries the status; a network failure has none.
      const status = (err as { httpStatus?: unknown } | null)?.httpStatus;
      const code = typeof status === "number" ? status : null;
      setHttpCode(code);
      signalSend({ kind: "land", ok: false, code });
      setStatus("error");
      setStage(-1);
    }
  };

  if (status === "sent") {
    return (
      <div
        className="contact-success"
        role="status"
        style={sentHeight ? { minHeight: sentHeight } : undefined}
      >
        <span className="contact-success-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <m.path
              d="M5 12.5 10 17.5 19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={
                motionAllowed ? { duration: 0.4, ease: EASE_OUT, delay: 0.1 } : { duration: 0 }
              }
            />
          </svg>
        </span>
        <h3 className="contact-success-title" ref={successRef} tabIndex={-1}>
          Message received
        </h3>
        <p className="contact-success-text">Thanks for writing.</p>
        {httpCode !== null && (
          <p className="contact-success-code mono">
            The server answered {httpCode}
            {STATUS_TEXT[httpCode] ? ` ${STATUS_TEXT[httpCode]}` : ""}
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            focusNext.current = "name";
            setStatus("idle");
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  const label = delivered ? "Sent" : sending ? "Sending" : "Send message";
  const state = delivered ? "sent" : status;
  const bucket = countBucket(remaining);
  const describe = (field: keyof Fields, ...extra: string[]) => {
    const ids = [showError(field) ? `${field}-error` : null, ...extra].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  };

  return (
    <form ref={formRef} className="contact-form" onSubmit={handleSubmit} noValidate aria-labelledby="contact-form-title">
      <div className="contact-form-head">
        <h3 className="subsection-title" id="contact-form-title">
          Send a message
        </h3>
        {/* The endpoint, labelled like other routes on the page. */}
        <Scramble text="POST /api/contact" trigger="inView" className="mono contact-endpoint" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            ref={nameRef}
            id="name"
            name="name"
            value={values.name}
            onChange={set("name")}
            onBlur={blur("name")}
            aria-invalid={showError("name") ? true : undefined}
            aria-describedby={describe("name")}
            autoComplete="name"
            disabled={sending}
          />
          {showError("name") && (
            <p className="field-error" id="name-error">
              {showError("name")}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            value={values.email}
            onChange={set("email")}
            onBlur={blur("email")}
            aria-invalid={showError("email") ? true : undefined}
            aria-describedby={describe("email")}
            autoComplete="email"
            spellCheck={false}
            disabled={sending}
          />
          {showError("email") && (
            <p className="field-error" id="email-error">
              {showError("email")}
            </p>
          )}
        </div>
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor="message">Message</label>
          <span
            className={cx("field-count", "mono", bucket === "over" ? "is-over" : bucket !== null && "is-low")}
            id="message-count"
          >
            <span aria-hidden="true">
              {values.message.length} / {LIMITS.message}
            </span>
            <span className="visually-hidden">
              {values.message.length} of {LIMITS.message} characters
            </span>
          </span>
        </div>
        <textarea
          id="message"
          name="message"
          rows={6}
          value={values.message}
          onChange={set("message")}
          onBlur={blur("message")}
          placeholder="What are you building, and where would I fit into it?"
          aria-invalid={showError("message") ? true : undefined}
          aria-describedby={describe("message", "message-count")}
          disabled={sending}
        />
        {showError("message") && (
          <p className="field-error" id="message-error">
            {showError("message")}
          </p>
        )}
        <span className="visually-hidden" role="status" aria-live="polite">
          {countNote}
        </span>
      </div>

      {/* Honeypot: off screen, untabbable, hidden from assistive tech; the API drops filled ones. */}
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {TURNSTILE_SITE_KEY && (
        <div className="field">
          <Turnstile key={turnstileRound} siteKey={TURNSTILE_SITE_KEY} onToken={setTurnstileToken} />
          {turnstileMissing && !turnstileToken && (
            <p className="field-error">Give the spam check a moment to finish, then send again.</p>
          )}
        </div>
      )}

      <div className="contact-actions">
        <Magnetic>
          <button
            className="btn btn-primary contact-submit"
            type="submit"
            aria-disabled={sending ? true : undefined}
            data-state={state}
          >
            <SubmitLabel label={label} />
          </button>
        </Magnetic>
        {/* The note hides behind the chips while sending. */}
        <span className="contact-actions-side">
          <span className={cx("contact-actions-note", "small", sending && "is-covered")}>
            Validated with Zod. No third-party form service.
          </span>
          <ChipStack state={state} />
        </span>
      </div>

      {sending && <SendTrace stage={stage} />}

      {status === "error" && (
        <p className="field-error field-error-block" role="alert">
          Something went wrong sending that
          {httpCode !== null ? ` (the server answered ${httpCode})` : ""}. Try again, or email me directly at{" "}
          {SITE.email}.
        </p>
      )}

      {/* Data use, stated at the point of sending; nothing optional, so no checkbox. */}
      <p className="contact-privacy-note small">
        I use your name, email and message only to reply to you, and delete them after{" "}
        {RETENTION.label}. <a href="/privacy">How your message is handled</a>.
      </p>
    </form>
  );
}
