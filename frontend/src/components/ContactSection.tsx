import { ContactForm } from "./ContactForm";
import { Reveal } from "./Reveal";
import { SectionHead } from "./SectionHead";

const ROUTES = [
  {
    label: "Email",
    value: "Manugaginodh2@gmail.com",
    href: "mailto:Manugaginodh2@gmail.com",
    note: "Anything detailed.",
  },
  {
    label: "GitHub",
    value: "github.com/ManugaHewa",
    href: "https://github.com/ManugaHewa",
    note: "Every project here, in full.",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/manugahewa",
    href: "https://www.linkedin.com/in/manugahewa",
    note: "The formal version.",
  },
];

const EXPECTATIONS = [
  {
    title: "A reply, from me",
    body: "Not an autoresponder.",
  },
  {
    title: "Usually a day or two",
    body: "Email is the reliable backup.",
  },
  {
    title: "Happy to go deep",
    body: "Ask about any trade-off and you get the real answer.",
  },
];

export function ContactSection() {
  return (
    <section className="section container" id="contact" aria-labelledby="contact-heading">
      <SectionHead
        index="04"
        kicker="Next step"
        title="Let's talk about the work"
        id="contact-heading"
        note="Validated with Zod, stored in Postgres."
      />

      <div className="contact-layout">
        <Reveal className="contact-main">
          <div className="contact-panel">
            <ContactForm />
          </div>
        </Reveal>

        <Reveal delay={90} className="contact-side">
          <div className="contact-routes">
            <h3 className="contact-side-title">Or reach me directly</h3>
            {ROUTES.map((r) => (
              <a
                className="contact-route"
                key={r.label}
                href={r.href}
                target={r.href.startsWith("http") ? "_blank" : undefined}
                rel={r.href.startsWith("http") ? "noreferrer" : undefined}
              >
                <span className="contact-route-label">{r.label}</span>
                <span className="contact-route-value">{r.value}</span>
                <span className="contact-route-note">{r.note}</span>
              </a>
            ))}
          </div>

          <div className="contact-expect">
            <h3 className="contact-side-title">What happens next</h3>
            <ul>
              {EXPECTATIONS.map((e) => (
                <li key={e.title}>
                  <strong>{e.title}</strong>
                  <span>{e.body}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="contact-availability">
            <span className="contact-status-dot" aria-hidden="true" />
            <div>
              <strong>Open to full-stack roles</strong>
              <span>Based in Canada. Open to full-stack roles.</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
