import { memo } from "react";
import { RESUME, SITE } from "../site";

/**
 * Footer on every page. No animation imports: the privacy page and 404 load
 * none. "Back to top" targets #top, which every page has. The SVG wordmark
 * spans the column via textLength; decorative (the name is in the row below).
 */
export const Footer = memo(function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <svg className="site-footer-mark" viewBox="0 0 1000 96" aria-hidden="true" focusable="false">
          <text x="0" y="80" textLength="1000" lengthAdjust="spacingAndGlyphs">
            {SITE.name}
          </text>
        </svg>
      </div>
      <div className="container site-footer-inner">
        <div className="site-footer-who">
          <p className="site-footer-name">{SITE.name}</p>
          <p className="site-footer-place">{SITE.location}</p>
        </div>

        <p className="site-footer-colophon">
          Set in Mona Sans and Martian Mono. Built with React, Three.js and Motion, served from my
          own server.
        </p>

        <nav className="site-footer-nav" aria-label="Footer">
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
            {RESUME && (
              <li>
                <a href={RESUME.href}>
                  Résumé<span className="visually-hidden"> (PDF, {RESUME.size})</span>
                </a>
              </li>
            )}
            <li>
              <a href="/privacy">Privacy</a>
            </li>
            <li>
              <a href="/privacy#credits">Credits</a>
            </li>
          </ul>
          <a className="site-footer-top" href="#top">
            Back to top
          </a>
        </nav>
      </div>
    </footer>
  );
});
