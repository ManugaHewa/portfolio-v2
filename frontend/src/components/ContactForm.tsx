import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "../motion/m";
import type { Variants } from "../motion/m";
import { Magnetic, Scramble, useMotionAllowed } from "../motion";
import { api } from "../api";
import { SendTrace } from "./SendTrace";
import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";
import { RETENTION, SITE } from "../site";

type Status = "idle" | "sending" | "sent" | "error";

// Mirrors the Zod schema the API enforces in backend/src/routes/contact.ts.
// Checking here too is not duplication for its own sake: it turns a 400 that
// costs a round trip into an inline message the moment the field is left.
export const LIMITS = { name: 120, message: 2000, messageMin: 10 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The counter speaks only when the message crosses one of these, never per
// keystroke: a live region that changes on every key talks over the typing.
const COUNT_THRESHOLDS = [200, 50] as const;

interface Fields {
  name: string;
  email: string;
  message: string;
}

const EMPTY: Fields = { name: "", email: "", message: "" };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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

/** Which threshold bucket a remaining count sits in: "over", 50, 200, or none. */
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
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1], delay: i * 0.0125 },
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
 * The submit button's label: the old word rolls up and out letter by letter,
 * the new one rolls in from below, and the label's width springs between the
 * two lengths so the button never jumps. The width is read from an invisible
 * copy set the same way (letter by letter), because a whole word is kerned
 * and can measure narrower than its letters laid side by side.
 *
 * The state is not announced from here: SendTrace's status region already
 * says what is happening, and two live regions would talk over each other.
 */
function SubmitLabel({ label }: { label: string }) {
  const animate = useMotionAllowed();
  const ghost = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
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
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [values, setValues] = useState<Fields>(EMPTY);
  // Errors surface once a field has been left or a submit has been attempted,
  // rather than shouting at someone who has only just started typing.
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  // Which hop of the send trace is in flight. -1 when idle.
  const [stage, setStage] = useState(-1);
  // True from the moment the API answers until the success panel replaces
  // the form, so the button can say "Sent" while the trace finishes.
  const [delivered, setDelivered] = useState(false);
  // The honeypot's value. Kept out of `values` because it is not a field
  // anyone is meant to fill in, validate, or see.
  const [website, setWebsite] = useState("");
  // When the form appeared. The API drops anything sent within a few seconds
  // of that, which no person typing a message manages.
  const shownAt = useRef(Date.now());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Bumped to remount the widget, because each token is good for one send.
  const [turnstileRound, setTurnstileRound] = useState(0);
  const [turnstileMissing, setTurnstileMissing] = useState(false);
  // The counter's announcement, set only when a threshold is crossed.
  const [countNote, setCountNote] = useState("");
  const lastBucket = useRef<ReturnType<typeof countBucket>>(null);

  const motionAllowed = useMotionAllowed();
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The form's height when it was sent. The success view keeps it as a
  // minimum, so swapping views does not pull the page up under the reader.
  const [sentHeight, setSentHeight] = useState<number | null>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  // Where focus goes when the view swaps: the success heading after a send
  // (the button that had focus is gone), the name field on "Send another".
  const focusNext = useRef<"success" | "name" | null>(null);

  const errors = validate(values);
  const showError = (field: keyof Fields) =>
    (touched[field] || submitted) && errors[field] ? errors[field] : null;

  const remaining = LIMITS.message - values.message.length;
  const sending = status === "sending";

  useEffect(() => {
    const bucket = countBucket(remaining);
    if (bucket !== lastBucket.current) {
      // Said on the way down (200 left, 50 left, over), silent on the way
      // back up so deleting text does not trigger a commentary.
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
    // The button stays focusable while sending (aria-disabled rather than
    // disabled, so a keyboard user's focus is not dropped to the page), so a
    // second press is ignored here instead.
    if (sending) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      // The first field in error takes focus, which says where to look.
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
    // Validation has genuinely already passed at this point, so the first
    // step is shown as complete rather than pending.
    setStage(0);
    try {
      // The trace advances to the network hop on the next frame, so the
      // first segment is visibly drawn even on a fast local response.
      requestAnimationFrame(() => setStage(1));
      const token = turnstileToken;
      if (TURNSTILE_SITE_KEY) {
        // Spent by this send either way, so ask the widget for a new one now.
        setTurnstileToken(null);
        setTurnstileRound((round) => round + 1);
      }
      await api.sendContactMessage({
        ...values,
        website,
        elapsedMs: Date.now() - shownAt.current,
        ...(token ? { turnstileToken: token } : {}),
      });
      // The server answered, which means it parsed and persisted. Walk the
      // last two hops at a readable pace before switching to the success view.
      setDelivered(true);
      setStage(2);
      await new Promise((r) => setTimeout(r, 260));
      setStage(3);
      await new Promise((r) => setTimeout(r, 380));
      focusNext.current = "success";
      setSentHeight(formRef.current?.offsetHeight ?? null);
      setStatus("sent");
      setStage(-1);
      setDelivered(false);
      setValues(EMPTY);
      setTouched({});
      setSubmitted(false);
    } catch {
      setStatus("error");
      setStage(-1);
      setDelivered(false);
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
                motionAllowed ? { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 } : { duration: 0 }
              }
            />
          </svg>
        </span>
        <h3 className="contact-success-title" ref={successRef} tabIndex={-1}>
          Message received
        </h3>
        <p className="contact-success-text">Thanks for writing.</p>
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
        {/* The endpoint the form posts to, set as a label like every other
            file and route name on the page. */}
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
          <span className={`field-count mono${remaining < 0 ? " is-over" : remaining <= 200 ? " is-low" : ""}`} id="message-count">
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

      {/* The honeypot. Off screen, out of the tab order and hidden from
          assistive tech, so nobody using the form ever meets it; the API
          quietly drops anything that arrives with it filled in. */}
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
            data-state={delivered ? "sent" : status}
          >
            <SubmitLabel label={label} />
          </button>
        </Magnetic>
        <span className="contact-actions-note small">Validated with Zod. No third-party form service.</span>
      </div>

      {sending && stage >= 0 && <SendTrace stage={stage} />}

      {status === "error" && (
        <p className="field-error field-error-block" role="alert">
          Something went wrong sending that. Try again, or email me directly at {SITE.email}.
        </p>
      )}

      {/* What happens to the message, said where the decision to send is
          made. No checkbox: there is nothing optional to consent to. */}
      <p className="contact-privacy-note small">
        I use your name, email and message only to reply to you, and delete them after{" "}
        {RETENTION.label}. <a href="/privacy">How your message is handled</a>.
      </p>
    </form>
  );
}
