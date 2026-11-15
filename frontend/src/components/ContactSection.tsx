import { memo } from "react";
import { ContactForm } from "./ContactForm";
import { CopyEmail } from "./CopyEmail";
import { Scene } from "./Scene";
import { SectionHead } from "../motion";
import { SITE } from "../site";

const PROFILES = [
  { label: "GitHub", path: SITE.github.label, href: SITE.github.url },
  { label: "LinkedIn", path: SITE.linkedin.label, href: SITE.linkedin.url },
];

/**
 * Contact: direct routes on the left, the form on the right on an opaque
 * panel, so the signal scene never runs under typed text. Only the heading
 * animates; the section must be usable at once.
 */
export const ContactSection = memo(function ContactSection() {
  return (
    <section className="section contact" id="contact" aria-labelledby="contact-heading">
      <Scene variant="signal" className="scene-layer scene-signal" />

      <div className="container">
        <SectionHead
          titleId="contact-heading"
          title="Get in touch"
          intro={`Open to full-stack roles, hybrid or remote, from ${SITE.location}.`}
        >
          <p className="readout contact-reply">Usually replies within two days</p>
        </SectionHead>

        <div className="contact-grid">
          <div className="contact-direct">
            <dl className="contact-routes">
              <div className="contact-route contact-route-email">
                <dt className="mono contact-route-label">Email</dt>
                <dd className="contact-route-value">
                  <CopyEmail email={SITE.email} />
                </dd>
              </div>
              {PROFILES.map((p) => (
                <div className="contact-route" key={p.label}>
                  <dt className="mono contact-route-label">{p.label}</dt>
                  <dd className="contact-route-value">
                    <a className="contact-profile mono" href={p.href} target="_blank" rel="noreferrer">
                      {p.path}
                      <span className="contact-profile-arrow" aria-hidden="true" />
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="contact-aside">
              Ask about any trade-off in the work above and you will get the real answer,
              including what I would do differently.
            </p>
          </div>

          <div className="contact-panel">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
});
