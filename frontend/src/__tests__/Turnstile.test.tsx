import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const SCRIPT = 'script[src*="challenges.cloudflare.com/turnstile"]';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  document.head.querySelectorAll(SCRIPT).forEach((s) => s.remove());
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("is compiled out unless a site key is set at build time", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const { TURNSTILE_SITE_KEY } = await import("../components/Turnstile");
    expect(TURNSTILE_SITE_KEY).toBeUndefined();
  });

  it("loads Cloudflare's script once and hands the token to the form", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const { Turnstile, TURNSTILE_SITE_KEY } = await import("../components/Turnstile");
    expect(TURNSTILE_SITE_KEY).toBe("1x00000000000000000000AA");

    const onToken = vi.fn();
    render(<Turnstile siteKey="1x00000000000000000000AA" onToken={onToken} />);

    const scripts = document.head.querySelectorAll<HTMLScriptElement>(SCRIPT);
    expect(scripts).toHaveLength(1);

    // Stand in for Cloudflare's script arriving.
    let options: Record<string, unknown> = {};
    window.turnstile = {
      render: vi.fn((_el: HTMLElement, opts: Record<string, unknown>) => {
        options = opts;
        return "widget-1";
      }),
      remove: vi.fn(),
    };
    await act(async () => {
      scripts[0].onload?.(new Event("load"));
    });

    expect(window.turnstile.render).toHaveBeenCalledTimes(1);
    expect(options.sitekey).toBe("1x00000000000000000000AA");

    (options.callback as (token: string) => void)("token-abc");
    expect(onToken).toHaveBeenLastCalledWith("token-abc");

    (options["expired-callback"] as () => void)();
    expect(onToken).toHaveBeenLastCalledWith(null);
  });
});
