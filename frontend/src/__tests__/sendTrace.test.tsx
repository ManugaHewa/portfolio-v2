import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LazyMotion, domMax } from "../motion/m";
import { SendTrace, TRACE_STEPS } from "../components/SendTrace";

// The app renders everything inside LazyMotion strict; so do these, so a
// stray `motion.*` import would throw here as it would in the page.
const renderTrace = (stage: number) =>
  render(
    <LazyMotion features={domMax} strict>
      <SendTrace stage={stage} />
    </LazyMotion>,
  );

describe("SendTrace", () => {
  it("marks earlier hops done and the current one active", () => {
    const { container } = renderTrace(1);
    const steps = [...container.querySelectorAll(".trace-step")];

    expect(steps).toHaveLength(TRACE_STEPS.length);
    expect(steps[0].className).toContain("is-done");
    expect(steps[1].className).toContain("is-active");
    expect(steps[2].className).not.toContain("is-active");
    expect(steps[3].className).not.toContain("is-done");
  });

  it("announces progress to assistive tech", () => {
    renderTrace(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Sending: step 3 of ${TRACE_STEPS.length}, ${TRACE_STEPS[2]}`,
    );
  });

  it("keeps the drawn trace out of the accessibility tree", () => {
    // The status line already says where the message is; the hop labels
    // read aloud as well would say it twice.
    const { container } = renderTrace(0);
    expect(container.querySelector(".send-trace-list")).toHaveAttribute("aria-hidden", "true");
  });

  it("names the real hops, in order", () => {
    expect(TRACE_STEPS).toEqual(["validate", "POST /api/contact", "zod.parse", "Postgres"]);
  });

  it("draws one connector between each pair of hops", () => {
    const { container } = renderTrace(3);
    expect(container.querySelectorAll(".trace-link")).toHaveLength(TRACE_STEPS.length - 1);
    expect(container.querySelectorAll(".trace-step.is-done")).toHaveLength(3);
  });
});
