import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CASE_TITLE, transitionSource, useCaseTransition } from "../lib/caseTransition";

function Harness() {
  useCaseTransition();
  return (
    <div>
      <div className="pcard is-up" id="case-dms">
        <div className="pcard-face">DMS</div>
      </div>
      <a href="/work/dms/" className="to-dms">
        DMS
      </a>
      <a href="/work/alice/" className="to-alice">
        Alice
      </a>
    </div>
  );
}

const click = (el: Element, init: MouseEventInit = {}) => {
  const e = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  // The browser would navigate; a test page must not. On the window, which
  // hears the click after the document's listener has had it.
  window.addEventListener("click", (ev) => ev.preventDefault(), { once: true });
  el.dispatchEvent(e);
  return e;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the card-to-page transition", () => {
  it("names the face-up card when it is the project being opened", () => {
    const { container } = render(<Harness />);
    click(container.querySelector(".to-dms")!);
    expect(container.querySelector<HTMLElement>(".pcard-face")!.style.getPropertyValue("view-transition-name")).toBe(
      CASE_TITLE,
    );
  });

  it("names the link itself for a project that is not face up, and only one element at a time", () => {
    const { container } = render(<Harness />);
    click(container.querySelector(".to-dms")!);
    click(container.querySelector(".to-alice")!);
    const named = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.getPropertyValue("view-transition-name") === CASE_TITLE,
    );
    expect(named).toHaveLength(1);
    expect(named[0]).toHaveClass("to-alice");
  });

  it("leaves a modified click alone", () => {
    const { container } = render(<Harness />);
    click(container.querySelector(".to-dms")!, { ctrlKey: true });
    expect(container.querySelector("[data-case-transition]")).toBeNull();
  });

  it("prefers an open dialog's figure", () => {
    document.body.innerHTML = '<div role="dialog"><div class="dialog-figure"></div></div><a href="/work/dms/">x</a>';
    const link = document.querySelector("a")!;
    expect(transitionSource(link, "dms")).toBe(document.querySelector(".dialog-figure"));
  });
});
