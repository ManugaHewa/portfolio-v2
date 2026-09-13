import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SpotlightPanel } from "../components/SpotlightPanel";

// The .panel spotlight gradient reads --mx/--my. Those variables went unset
// for the life of the stylesheet, so the effect silently did nothing. This
// pins the wiring: if the pointer handler is dropped again, this fails.
describe("SpotlightPanel", () => {
  it("writes the cursor position into --mx and --my on pointer move", () => {
    render(
      <SpotlightPanel>
        <p>Full-stack ownership</p>
      </SpotlightPanel>
    );

    const panel = screen.getByText("Full-stack ownership").parentElement!;
    expect(panel.style.getPropertyValue("--mx")).toBe("");

    // jsdom reports a zero-sized rect, so stub a real box to divide against.
    panel.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 200, height: 100 }) as DOMRect;

    fireEvent.pointerMove(panel, { clientX: 150, clientY: 75 });

    expect(panel.style.getPropertyValue("--mx")).toBe("25%");
    expect(panel.style.getPropertyValue("--my")).toBe("25%");
  });

  it("keeps the panel class so the existing styling still applies", () => {
    render(<SpotlightPanel className="extra">content</SpotlightPanel>);
    const panel = screen.getByText("content");
    expect(panel).toHaveClass("panel", "panel-spotlight", "extra");
  });
});
