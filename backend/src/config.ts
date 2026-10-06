/**
 * Everything the API takes from the environment, read in one place.
 *
 * Every default is the production answer, so a variable that goes missing can
 * only ever make the server stricter, never looser. That matters here because
 * the server's backend/.env has drifted before: it still said
 * NODE_ENV=development long after the site went public.
 */
export interface Config {
  /** Origins allowed to call the API from a browser. Same-origin needs none. */
  corsOrigins: string[];
  /** Cloudflare Turnstile secret. Unset means the check is off. */
  turnstileSecret: string | null;
}

const PRODUCTION_ORIGIN = "https://manugahewa.dev";
const VITE_DEV_ORIGIN = "http://localhost:5173";

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const listed = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    // The Vite dev server proxies /api, so even local development is
    // same-origin; the localhost entry only covers calling the API directly
    // from a page on the dev server's port.
    corsOrigins:
      listed.length > 0
        ? listed
        : env.NODE_ENV === "development"
          ? [PRODUCTION_ORIGIN, VITE_DEV_ORIGIN]
          : [PRODUCTION_ORIGIN],
    turnstileSecret: env.TURNSTILE_SECRET_KEY?.trim() || null,
  };
}
