import { Footer } from "./Footer";
import { RETENTION, SITE } from "../site";

/**
 * What the site does with people's data, in plain words. Every sentence here
 * has to stay true of the code and the server, so the dependencies are listed:
 *
 * - Fields stored: backend/prisma/schema.prisma (ContactMessage) and the
 *   strict schema in backend/src/routes/contact.ts.
 * - Retention: RETENTION in site.ts, enforced by `npm run contact:prune` on a
 *   daily cron (docs/manual-steps.md).
 * - No analytics: Cloudflare Web Analytics switched off in the dashboard; the
 *   CSP in deploy/nginx/portfolio.conf would block it anyway.
 * - Logs: the anonymised access-log format in deploy/nginx/portfolio.conf,
 *   and Ubuntu's 14-day rotation for Nginx.
 * - Rate limiting: the 15-minute in-memory window in backend/src/app.ts.
 *
 * No cookies and no browser storage: measured, not assumed (docs/audit-2026-10.md).
 */
const UPDATED = "6 October 2026";

const LIBRARIES = [
  { name: "React", use: "the interface", licence: "MIT", url: "https://react.dev" },
  { name: "Three.js", use: "the 3D scenes", licence: "MIT", url: "https://threejs.org" },
  { name: "GSAP", use: "the hero animation", licence: "GSAP Standard “No Charge” licence", url: "https://gsap.com/standard-license" },
  { name: "Framer Motion", use: "scroll and reveal animation", licence: "MIT", url: "https://motion.dev" },
  { name: "Lenis", use: "smooth scrolling", licence: "MIT", url: "https://lenis.darkroom.engineering" },
];

export function PrivacyPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header legal-header">
        <nav className="nav" aria-label="Primary">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              MH
            </span>
            <span className="brand-text">{SITE.name}</span>
          </a>
          <a className="legal-back" href="/">
            Back to the portfolio
          </a>
        </nav>
      </header>

      <main id="main" className="legal container">
        <h1>Privacy</h1>
        <p className="legal-updated">Last updated {UPDATED}</p>

        <p className="legal-lead">
          This is my personal portfolio. There are no accounts, nothing is for sale, and the only
          thing you can send me through it is a message. This page says what happens to that message
          and to the rest of the traffic.
        </p>

        <section aria-labelledby="collect">
          <h2 id="collect">What the contact form collects</h2>
          <p>
            Your name, your email address, your message, and the time you sent it. Nothing else is
            stored with it: not your IP address, not your browser, not your location.
          </p>
          <p>
            Two other things travel with the form and are thrown away once checked: a hidden field
            that only spam bots fill in, and how long the form was open before you pressed send.
          </p>
        </section>

        <section aria-labelledby="why">
          <h2 id="why">Why</h2>
          <p>
            So I can read your message and reply to it. I don&rsquo;t add you to a mailing list, and I
            don&rsquo;t share, sell or publish what you send.
          </p>
        </section>

        <section aria-labelledby="where">
          <h2 id="where">Where it is kept, and for how long</h2>
          <p>
            In a PostgreSQL database on a server I run myself, in Ontario, Canada. Messages are
            deleted automatically {RETENTION.label} after they arrive.
          </p>
        </section>

        <section aria-labelledby="delete">
          <h2 id="delete">Deleting your message, or getting a copy</h2>
          <p>
            Email me at <a href={`mailto:${SITE.email}`}>{SITE.email}</a> from the address you used,
            and I will delete every message from that address and tell you when it is done. You can
            also ask for a copy of what I hold about you.
          </p>
        </section>

        <section aria-labelledby="cloudflare">
          <h2 id="cloudflare">Who else handles the traffic</h2>
          <p>
            Every request to this site passes through Cloudflare, which runs the domain&rsquo;s DNS,
            the HTTPS connection and the tunnel to my server. To do that it processes technical data
            such as your IP address; its{" "}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
              privacy policy
            </a>{" "}
            covers what it keeps.
          </p>
          <p>
            Links to GitHub, LinkedIn and project repositories take you to those sites, where their
            own policies apply.
          </p>
        </section>

        <section aria-labelledby="cookies">
          <h2 id="cookies">Cookies and tracking</h2>
          <p>
            This site sets no cookies and stores nothing in your browser. There are no analytics, ads
            or tracking scripts, which is why there is no cookie banner.
          </p>
        </section>

        <section aria-labelledby="logs">
          <h2 id="logs">Server logs</h2>
          <p>
            The web server logs each request (the time, the page and the response) and keeps the log
            for up to 14 days. Ordinary entries record only the first three parts of your IP address.
            Entries for errors, such as a request that is too large, can include the full address.
          </p>
          <p>
            To slow down spam, the API also counts requests per IP address for 15 minutes. That count
            is held in memory and never written to disk.
          </p>
        </section>

        <section aria-labelledby="changes">
          <h2 id="changes">Changes</h2>
          <p>If any of this changes, I will update this page and the date at the top.</p>
        </section>

        <section aria-labelledby="terms">
          <h2 id="terms">Terms</h2>
          <p>
            The site and everything on it is provided as is, without any warranty. The projects
            shown belong to their owners: some were built for clients or with teams, and their code
            is linked only where I am able to share it. Third-party software is used under its own
            licence, listed below.
          </p>
        </section>

        <section aria-labelledby="credits-heading" id="credits">
          <h2 id="credits-heading">Credits</h2>
          <p>
            No fonts are downloaded: text uses your device&rsquo;s own system fonts. The 3D scenes are
            drawn in code with Three.js, with no third-party models or textures. The libraries that
            run in your browser:
          </p>
          <ul className="legal-credits">
            {LIBRARIES.map((lib) => (
              <li key={lib.name}>
                <a href={lib.url} target="_blank" rel="noreferrer">
                  {lib.name}
                </a>
                , for {lib.use} ({lib.licence})
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
    </>
  );
}
