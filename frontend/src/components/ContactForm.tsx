import { useState } from "react";
import { api } from "../api";

type Status = "idle" | "sending" | "sent" | "error";

// Mirrors the Zod schema the API enforces in backend/src/routes/contact.ts.
// Checking here too is not duplication for its own sake: it turns a 400 that
// costs a round trip into an inline message the moment the field is left.
const LIMITS = { name: 120, message: 2000, messageMin: 10 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [values, setValues] = useState<Fields>(EMPTY);
  // Errors surface once a field has been left or a submit has been attempted,
  // rather than shouting at someone who has only just started typing.
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(values);
  const showError = (field: keyof Fields) =>
    (touched[field] || submitted) && errors[field] ? errors[field] : null;

  const set = (field: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const blur = (field: keyof Fields) => () =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    setStatus("sending");
    try {
      await api.sendContactMessage(values);
      setStatus("sent");
      setValues(EMPTY);
      setTouched({});
      setSubmitted(false);
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="contact-success" role="status">
        <span className="contact-success-mark" aria-hidden="true">
          ✓
        </span>
        <h3>Message received</h3>
        <p>Stored in Postgres, not a form that goes nowhere. I reply within a day or two.</p>
        <button type="button" className="btn btn-ghost" onClick={() => setStatus("idle")}>
          Send another message
        </button>
      </div>
    );
  }

  const remaining = LIMITS.message - values.message.length;
  const sending = status === "sending";

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            value={values.name}
            onChange={set("name")}
            onBlur={blur("name")}
            aria-invalid={showError("name") ? true : undefined}
            aria-describedby={showError("name") ? "name-error" : undefined}
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
            value={values.email}
            onChange={set("email")}
            onBlur={blur("email")}
            aria-invalid={showError("email") ? true : undefined}
            aria-describedby={showError("email") ? "email-error" : undefined}
            autoComplete="email"
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
          <span className={`field-count${remaining < 0 ? " is-over" : ""}`}>
            {values.message.length} / {LIMITS.message}
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
          aria-describedby={showError("message") ? "message-error" : undefined}
          disabled={sending}
        />
        {showError("message") && (
          <p className="field-error" id="message-error">
            {showError("message")}
          </p>
        )}
      </div>

      <div className="contact-actions">
        <button className="btn btn-primary" type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send message"}
        </button>
        <span className="contact-actions-note">
          Validated with Zod. No third-party form service.
        </span>
      </div>

      {status === "error" && (
        <p className="field-error field-error-block" role="alert">
          Something went wrong sending that. Try again, or email me directly at
          Manugaginodh2@gmail.com.
        </p>
      )}
    </form>
  );
}
