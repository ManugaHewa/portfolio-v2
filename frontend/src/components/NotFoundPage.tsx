import { Footer } from "./Footer";
import { SITE } from "../site";

/**
 * Rendered once at build time into dist/404.html, which Nginx serves with a
 * real 404 status. Static HTML with no script: there is nothing to hydrate.
 * Before this, every unknown address got the home page and a 200.
 */
export function NotFoundPage() {
  return (
    <>
      <header className="site-header legal-header">
        <nav className="nav" aria-label="Primary">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              MH
            </span>
            <span className="brand-text">{SITE.name}</span>
          </a>
        </nav>
      </header>

      <main id="main" className="legal container">
        <h1>Page not found</h1>
        <p className="legal-lead">There is nothing at this address.</p>
        <p>
          <a href="/">Go to the portfolio</a> or <a href="/privacy">read the privacy page</a>.
        </p>
      </main>

      <Footer />
    </>
  );
}
