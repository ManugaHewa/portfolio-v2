import { Footer } from "./Footer";
import { LegalHeader } from "./PrivacyPage";

/**
 * Rendered once at build time into dist/404.html, which Nginx serves with a
 * real 404 status. Static HTML with no script: there is nothing to hydrate.
 * It borrows the privacy page's stylesheet (scripts/prerender.mjs), which
 * covers the header, the footer and this column.
 */
export function NotFoundPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <LegalHeader />

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
