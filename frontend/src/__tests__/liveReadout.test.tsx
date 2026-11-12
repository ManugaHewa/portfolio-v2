import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { LiveReadout } from "../components/LiveReadout";
import { recordProjectsTiming, resetProjectsTiming } from "../lib/liveStats";
import { Wrap } from "./motion/helpers";

const BUILD = { commit: "abc1234", date: "11 Nov 2026" };

afterEach(() => {
  resetProjectsTiming();
  vi.restoreAllMocks();
});

describe("LiveReadout", () => {
  it("prerenders a placeholder, never a made-up number", () => {
    const html = renderToString(
      <Wrap>
        <LiveReadout build={BUILD} />
      </Wrap>,
    );
    expect(html).toContain("–");
    expect(html).not.toMatch(/\d+<!-- -->\s*ms|\d+ ms/);
    expect(html).toContain("abc1234");
    expect(html).toContain("11 Nov 2026");
  });

  it("shows this visit's measurement once the request has answered", () => {
    const { container } = render(
      <Wrap>
        <LiveReadout build={BUILD} />
      </Wrap>,
    );
    act(() => recordProjectsTiming({ ok: true, ms: 42, count: 13 }));
    const values = Array.from(container.querySelectorAll(".live-value")).map((v) => v.textContent);
    expect(values[0]).toContain("42");
    expect(values[0]).toContain("ms");
    expect(values[1]).toContain("13");
  });

  it("says a failed request failed, in words", () => {
    render(
      <Wrap>
        <LiveReadout build={BUILD} />
      </Wrap>,
    );
    act(() => recordProjectsTiming({ ok: false }));
    expect(screen.getByText("API unreachable")).toBeInTheDocument();
    expect(screen.queryByText(/ ms$/)).toBeNull();
  });

  it("leaves the build out when there was no git", () => {
    const { container } = render(
      <Wrap>
        <LiveReadout build={null} />
      </Wrap>,
    );
    expect(container.textContent).not.toContain("commit");
  });
});

describe("api.getProjects timing", () => {
  it("records how long the request took and how many projects came back", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ slug: "a" }, { slug: "b" }]), { status: 200 }),
    );
    const seen: unknown[] = [];
    const { container } = render(
      <Wrap>
        <LiveReadout build={null} />
      </Wrap>,
    );
    await act(async () => {
      seen.push(await api.getProjects());
    });
    expect(seen[0]).toHaveLength(2);
    expect(container.querySelectorAll(".live-value")[1].textContent).toContain("2");
  });

  it("records a failure as a failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));
    render(
      <Wrap>
        <LiveReadout build={null} />
      </Wrap>,
    );
    await act(async () => {
      await expect(api.getProjects()).rejects.toThrow();
    });
    expect(screen.getByText("API unreachable")).toBeInTheDocument();
  });
});
