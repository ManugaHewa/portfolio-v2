import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CountUp } from "../components/CountUp";
import { MaskedWords } from "../components/MaskedWords";
import { SendTrace, TRACE_STEPS } from "../components/SendTrace";

describe("CountUp", () => {
  it("renders the final value up front rather than a zero placeholder", () => {
    // The tween overwrites this once it runs. Rendering the real number as
    // the initial content means a reader still gets the correct figure if the
    // animation never plays: reduced motion, no JS, a failed effect.
    render(<CountUp value={52} />);
    expect(screen.getByText("52")).toBeInTheDocument();
  });

  it("keeps the decimal places it was given", () => {
    // 3.8 must not settle as 4.
    render(<CountUp value={3.8} decimals={1} />);
    expect(screen.getByText("3.8")).toBeInTheDocument();
  });

  it("applies a prefix and suffix around the number", () => {
    render(<CountUp value={30} prefix="~" suffix="%" />);
    expect(screen.getByText("~30%")).toBeInTheDocument();
  });
});

describe("MaskedWords", () => {
  const LINE = "I turn ideas into shipped, production-grade software.";

  it("splits into one mask per word without losing any text", () => {
    const { container } = render(<MaskedWords text={LINE} />);

    expect(container.querySelectorAll(".mask-word")).toHaveLength(LINE.split(" ").length);
    // The spaces live outside the clipped wrappers, so the sentence still
    // reads as one string and can still wrap between words.
    expect(container.textContent).toBe(LINE);
  });
});

describe("SendTrace", () => {
  it("marks earlier hops done and the current one active", () => {
    const { container } = render(<SendTrace stage={1} />);
    const steps = [...container.querySelectorAll(".trace-step")];

    expect(steps).toHaveLength(TRACE_STEPS.length);
    expect(steps[0].className).toContain("is-done");
    expect(steps[1].className).toContain("is-active");
    expect(steps[2].className).not.toContain("is-active");
    expect(steps[3].className).not.toContain("is-done");
  });

  it("announces progress to assistive tech", () => {
    render(<SendTrace stage={2} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Sending: step 3 of ${TRACE_STEPS.length}, ${TRACE_STEPS[2]}`
    );
  });
});
