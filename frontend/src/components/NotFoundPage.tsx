import { Footer } from "./Footer";
import { LegalHeader } from "./PrivacyPage";
import { CardBack } from "./deck/PlayingCard";

/**
 * Prerendered to dist/404.html (Nginx serves it with a 404 status). Static,
 * no script; uses the privacy page's stylesheet. A lost card lies back up;
 * hover or focus turns it over (legal.css). It links back to the deck.
 */
export function NotFoundPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <LegalHeader />

      <main id="main" className="legal container not-found">
        <a className="lost-card" href="/#work-index">
          <span className="lost-card-inner" aria-hidden="true">
            <CardBack />
            <span className="lost-card-face">
              <span className="lost-card-index">
                404
                <span className="pcard-suit is-other" />
              </span>
              <span className="lost-card-index is-flipped">
                404
                <span className="pcard-suit is-other" />
              </span>
              <span className="lost-card-title">Not in this deck</span>
              <span className="lost-card-line">Back to the thirteen that are</span>
            </span>
          </span>
          <span className="visually-hidden">Back to the deck of projects</span>
        </a>

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
