import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, behind a build-time switch.
 *
 * Off unless VITE_TURNSTILE_SITE_KEY is set when the frontend is built, and
 * the API only checks tokens once TURNSTILE_SECRET_KEY is set on the server.
 * The honeypot and the timing check in ContactForm are the first line; this is
 * the second, for when they stop being enough. Switching it on also needs
 * challenges.cloudflare.com added to the CSP, which docs/manual-steps.md
 * spells out, and a sentence on the privacy page.
 */
export const TURNSTILE_SITE_KEY: string | undefined =
  import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || undefined;

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// One script for the page, however many times the form remounts.
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load"));
    script.onerror = () => {
      // Allow a later mount to try again rather than caching the failure.
      loading = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

interface Props {
  siteKey: string;
  /** A fresh token, or null when the last one expired or the check failed. */
  onToken: (token: string | null) => void;
}

/**
 * Tokens are single-use, so the form remounts this (by changing its key)
 * after every send to get a new one.
 */
export function Turnstile({ siteKey, onToken }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return;
        widgetId = api.render(ref.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return <div className="turnstile" ref={ref} />;
}
