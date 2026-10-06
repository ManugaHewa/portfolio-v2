import React from "react";
import ReactDOM from "react-dom/client";
import { PrivacyPage } from "./components/PrivacyPage";
import "./styles.css";

// Its own entry, so this page loads React and its own text and none of the
// animation or WebGL code the home page needs.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivacyPage />
  </React.StrictMode>
);
