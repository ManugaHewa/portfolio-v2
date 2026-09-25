import { ContactForm } from "./ContactForm";
import { Reveal } from "./Reveal";
import { SectionHead } from "./SectionHead";
import { CapabilityCard } from "./CapabilityCard";
import { CAPABILITIES, IMPACT } from "../capabilities";
import { Scene } from "./Scene";

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

/**
 * "Six things I bring to a codebase" used to be its own section between the
 * skills map and the contact form. As a standalone block it was a list of
 * claims with no reason to be read: the page had already shown the work and
 * the stack, and the reader's next question was how to get in touch, not
 * six more assertions. Merged in here the same six cards answer that
 * question - they are what you would be hiring, sitting directly above the
 * form instead of one scroll-length away from it.
 */
export function ContactSection() {
  return (
    <section className="section container has-scene" id="contact" aria-labelledby="contact-heading">
      <Scene variant="signal" className="scene-signal" />
      <SectionHead
        index="03"
        kicker="Next step"
        title="Let's talk about the work"
        id="contact-heading"
      />

      {/* Availability leads the section instead of closing it. It is the one
          thing a recruiter is scanning for, and it used to sit in a box below
          the fold of the section, under three other boxes. */}
      <Reveal>
        <div className="availability-bar">
          <span className="availability-state">
            <span className="contact-status-dot" aria-hidden="true" />
            Open to full-stack roles
          </span>
          <span className="availability-meta">Milton, Ontario · hybrid or remote</span>
          <span className="availability-reply">Replies in a day or two, from me, not a bot.</span>
        </div>
      </Reveal>

      <div className="contact-pitch">
        <h3 className="contact-pitch-title">What you would be getting</h3>
        <p className="contact-pitch-note">Hover any card for the receipt.</p>
      </div>

      <div className="about-grid">
        {CAPABILITIES.map((c, i) => (
          <Reveal key={c.title} delay={i * 60}>
            <CapabilityCard capability={c} />
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="impact-strip">
          <div className="impact-grid">
            {IMPACT.map((item) => (
              <div className="impact-item" key={item.title}>
                <div className="impact-title">{item.title}</div>
                <div className="impact-value">{item.value}</div>
                <div className="impact-note">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="contact-layout">
        <Reveal className="contact-main">
          <div className="contact-panel">
            <ContactForm />
          </div>
        </Reveal>

        {/* One panel rather than three stacked boxes: the old sidebar was
            more chrome than content. */}
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
                <span className="contact-route-go" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
                  </svg>
                </span>
              </a>
            ))}

            <p className="contact-aside-note">
              Ask about any trade-off in the work above and you will get the real answer,
              including what I would do differently.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
