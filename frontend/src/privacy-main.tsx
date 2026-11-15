import React from "react";
import ReactDOM from "react-dom/client";
import { PrivacyPage } from "./components/PrivacyPage";
// Only the styles the static pages use (not index.css).
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/legal.css";
import "./styles/cards.css";

// Own entry: no animation or WebGL code (scripts/check-chunks.mjs).
const root = document.getElementById("root")!;
const page = (
  <React.StrictMode>
    <PrivacyPage />
  </React.StrictMode>
);

// Prerendered, so normally hydrated.
if (root.hasChildNodes()) {
  ReactDOM.hydrateRoot(root, page);
} else {
  ReactDOM.createRoot(root).render(page);
}
