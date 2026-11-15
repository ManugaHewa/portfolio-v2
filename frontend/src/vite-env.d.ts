/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Cloudflare Turnstile site key; unset leaves the widget out (components/Turnstile.tsx). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

/** Build commit and date, or null without git (vite.config.ts buildStamp). */
declare const __BUILD__: { commit: string; date: string } | null;

/** The résumé PDF and its size, or null until frontend/public/resume.pdf exists (vite.config.ts resumeStamp). */
declare const __RESUME__: { href: string; size: string } | null;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
