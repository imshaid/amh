import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// Guards the harness itself: DOM matchers are registered and each test starts with a clean DOM.
describe("test setup", () => {
  it("renders into jsdom with DOM matchers available", () => {
    render(<p>harness</p>);
    expect(screen.getByText("harness")).toBeInTheDocument();
  });

  it("removes what earlier tests rendered", () => {
    expect(screen.queryByText("harness")).not.toBeInTheDocument();
    expect(document.body).toBeEmptyDOMElement();
  });
});
