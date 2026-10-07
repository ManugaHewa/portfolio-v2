import React from "react";
import ReactDOM from "react-dom/client";
import { PrivacyPage } from "./components/PrivacyPage";
import "./styles.css";

// Its own entry, so this page loads React and its own text and none of the
// animation or WebGL code the home page needs.
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
