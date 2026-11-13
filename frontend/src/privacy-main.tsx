import React from "react";
import ReactDOM from "react-dom/client";
import { PrivacyPage } from "./components/PrivacyPage";
// Only what this page draws: the type, the tokens, the shared base, the
// header and footer, the legal column, and the card back the 404 (which
// borrows this stylesheet) shows. Not index.css, which would bring
// every home-page section's styles with it.
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/legal.css";
import "./styles/cards.css";

// Its own entry, so this page loads React and its own text and none of the
// animation or WebGL code the home page needs (scripts/check-chunks.mjs).
const root = document.getElementById("root")!;
const page = (
  <React.StrictMode>
    <PrivacyPage />
  </React.StrictMode>
);

// Prerendered at build time (scripts/prerender.mjs), so normally hydrated.
if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, page);
} else {
  ReactDOM.createRoot(root).render(page);
}
