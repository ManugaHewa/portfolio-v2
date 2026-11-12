/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Cloudflare Turnstile site key. Unset, which is the default, leaves the
   * widget out of the build entirely. See components/Turnstile.tsx.
   */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

/**
 * The commit the build was made from, or null without git (vite.config.ts,
 * buildStamp). Shown in the pipeline section's live readout.
 */
declare const __BUILD__: { commit: string; date: string } | null;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
