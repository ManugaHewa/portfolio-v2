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
 * The last stop on the page, and the one a recruiter came for: who to write
 * to, and a form for when that is quicker. Two columns on a wide screen, the
 * direct routes on the left with no panel around them, the form on the right
 * on its own opaque panel so the signal scene behind the lower half of the
 * section never runs under text a visitor is typing.
 *
 * Nothing here has an entrance animation apart from the heading: the
 * section's job is to be usable the moment it scrolls in.
 */
export function ContactSection() {
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
}
