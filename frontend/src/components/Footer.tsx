import { SITE } from "../site";

/**
 * Who runs the site, where, and how to reach them, on every page. The site
 * had no footer at all, so the only place a name and a contact route appeared
 * was halfway down a long scroll.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <p className="site-footer-who">
          <span className="site-footer-name">{SITE.name}</span>
          <span className="site-footer-place">{SITE.location}</span>
        </p>
        <nav aria-label="Footer">
          <ul className="site-footer-links">
            <li>
              <a href={`mailto:${SITE.email}`}>Email</a>
            </li>
            <li>
              <a href={SITE.github.url} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <a href={SITE.linkedin.url} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </li>
            <li>
              <a href="/privacy">Privacy</a>
            </li>
            <li>
              <a href="/privacy#credits">Credits</a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
