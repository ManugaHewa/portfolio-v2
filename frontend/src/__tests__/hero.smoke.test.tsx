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

it("makes the name the page's one h1", () => {
  // What people type to find this page. The h1 used to be the tagline, which
  // did not contain the name at all.
  render(<Hero />);
  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent("Manuga Hewa Pathirana");
});
