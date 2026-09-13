import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { Hero } from "../components/Hero";

it("renders and unmounts cleanly", () => {
  const { unmount } = render(<Hero />);
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(screen.getByText("See the work")).toBeVisible();
  unmount();
  expect(document.querySelectorAll(".pin-spacer").length).toBe(0);
});
