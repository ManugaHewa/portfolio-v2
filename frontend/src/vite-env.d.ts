/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Turnstile site key; unset leaves the widget out (components/Turnstile.tsx). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

/** Build commit and date, or null without git (vite.config.ts buildStamp). */
declare const __BUILD__: { commit: string; date: string } | null;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
