import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpinPlaque } from "../components/SpinPlaque";
import { peekDeal, takeDeal } from "../lib/dealRequest";
import { answerSpin, readSpin } from "../lib/spin";
import type { SpinAsk } from "../lib/spin";
import { projectNumber } from "../stats";
import { projectSummaries } from "../../../content/projects";
import type { ProjectSummary } from "../types";
import { Wrap } from "./motion/helpers";

const all = projectSummaries() as ProjectSummary[];
const numbered = (n: number) =>
  all.find((p) => projectNumber(p.slug) === String(n).padStart(2, "0")) as ProjectSummary;
const top = all.length;

const plate = (live: boolean) =>
  render(
    <Wrap>
      <SpinPlaque projects={all} live={live} />
    </Wrap>,
  );
const spinButton = () => screen.getByRole("button", { name: "Spin the wheel" });
const said = (container: HTMLElement) => container.querySelector("[aria-live='polite']")?.textContent;
// jsdom's name computation spaces the hidden tail off from the title.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dealtLink = (title: string) =>
  screen.getByRole("link", { name: new RegExp(`^${escape(title)}\\s*, dealt in the work below$`) });

afterEach(() => {
  vi.restoreAllMocks();
  takeDeal();
});

describe("the spin plate", () => {
  it("waits for bets, with Spin at its end", () => {
    const { container } = plate(false);
    expect(container.querySelector(".spin-call")).toHaveTextContent("Place your bets");
    expect(spinButton()).not.toHaveAttribute("aria-disabled");
    expect(said(container)).toBe("");
  });

  it("with no live wheel, lands at once, says it, and deals that card", () => {
    // floor(0.5 * 14) = 7.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { container } = plate(false);
    fireEvent.click(spinButton());
    const seven = numbered(7);
    expect(container.querySelector(".spin-pocket")).toHaveTextContent("7");
    expect(dealtLink(seven.title)).toHaveAttribute("href", `/work/${seven.slug}/`);
    expect(said(container)?.trim()).toBe(`Landed on 7. ${seven.title} is dealt in the work below.`);
    expect(peekDeal()).toBe(seven.slug);
  });

  it("says the same number twice when it lands there twice", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { container } = plate(false);
    fireEvent.click(spinButton());
    const first = said(container);
    fireEvent.click(spinButton());
    expect(said(container)).not.toBe(first);
    expect(said(container)?.trim()).toBe(first?.trim());
  });

  it("deals nothing on the zero, which is the joker", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { container } = plate(false);
    fireEvent.click(spinButton());
    expect(container.querySelector(".spin-pocket")).toHaveTextContent("0");
    expect(container.querySelector(".spin-pocket")).toHaveClass("is-zero");
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "#contact");
    expect(container.querySelector(".spin-call")).toHaveTextContent("The zero is the joker");
    expect(peekDeal()).toBeNull();
  });

  it("with a live wheel, asks it to throw and waits for its answer", () => {
    const { container } = plate(true);
    fireEvent.click(spinButton());
    const ask = readSpin() as SpinAsk;
    expect(ask.top).toBe(top);
    expect(spinButton()).toHaveAttribute("aria-disabled", "true");
    expect(container.querySelector(".spin-call")).toHaveTextContent("No more bets");
    expect(said(container)).toBe("No more bets.");

    // A press while the ball is out asks nothing more.
    fireEvent.click(spinButton());
    expect(readSpin()?.id).toBe(ask.id);

    // An answer to some other ask is not this one's.
    act(() => answerSpin({ id: ask.id - 1, number: 5 }));
    expect(container.querySelector(".spin-pocket")).toBeNull();

    act(() => answerSpin({ id: ask.id, number: 3 }));
    const three = numbered(3);
    expect(container.querySelector(".spin-pocket")).toHaveTextContent("3");
    expect(container.querySelector(".spin-pocket")).toHaveClass("is-red");
    expect(said(container)?.trim()).toBe(`Landed on 3. ${three.title} is dealt in the work below.`);
    expect(dealtLink(three.title)).toHaveAttribute("href", `/work/${three.slug}/`);
    expect(peekDeal()).toBe(three.slug);
    expect(spinButton()).not.toHaveAttribute("aria-disabled");
  });

  it("lands by itself if the wheel goes away mid-throw", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const view = plate(true);
    fireEvent.click(spinButton());
    view.rerender(
      <Wrap>
        <SpinPlaque projects={all} live={false} />
      </Wrap>,
    );
    expect(view.container.querySelector(".spin-pocket")).toHaveTextContent(String(top));
    expect(spinButton()).not.toHaveAttribute("aria-disabled");
  });
});
