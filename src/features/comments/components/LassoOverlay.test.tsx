import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@/tests/helpers";
import { LassoOverlay } from "./LassoOverlay";
import type { ConnectorData } from "../layout-engine";

describe("LassoOverlay", () => {
  const createConnector = (
    overrides: Partial<ConnectorData> = {}
  ): ConnectorData => ({
    threadId: "thread-1",
    startX: 100,
    startY: 50,
    endX: 300,
    endY: 50,
    isDisplaced: false,
    displacement: 0,
    ...overrides,
  });

  it("returns null when no connectors", () => {
    const { container } = render(
      <LassoOverlay connectors={[]} highlightedThreadId={null} />
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders SVG with connectors", () => {
    const connectors = [createConnector()];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("lasso-overlay");
  });

  it("renders connector path with thread id", () => {
    const connectors = [createConnector({ threadId: "t1" })];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    const group = container.querySelector('[data-thread-id="t1"]');
    expect(group).toBeInTheDocument();
  });

  it("renders multiple connectors", () => {
    const connectors = [
      createConnector({ threadId: "t1" }),
      createConnector({ threadId: "t2", startY: 100, endY: 100 }),
    ];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    expect(container.querySelector('[data-thread-id="t1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-thread-id="t2"]')).toBeInTheDocument();
  });

  it("highlights the selected thread connector", () => {
    const connectors = [createConnector({ threadId: "t1" })];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId="t1" />
    );

    const highlightedPath = container.querySelector(
      ".lasso-connector--highlighted"
    );
    expect(highlightedPath).toBeInTheDocument();
  });

  it("applies displaced class when connector is displaced", () => {
    const connectors = [createConnector({ threadId: "t1", isDisplaced: true })];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    const displacedPath = container.querySelector(".lasso-connector--displaced");
    expect(displacedPath).toBeInTheDocument();
  });

  it("calls onHover with thread id on mouse enter", () => {
    const onHover = vi.fn();
    const connectors = [createConnector({ threadId: "t1" })];

    const { container } = render(
      <LassoOverlay
        connectors={connectors}
        highlightedThreadId={null}
        onHover={onHover}
      />
    );

    const hoverPath = container.querySelector(".lasso-connector-hover");
    if (hoverPath) {
      fireEvent.mouseEnter(hoverPath);
    }

    expect(onHover).toHaveBeenCalledWith("t1");
  });

  it("calls onHover with null on mouse leave", () => {
    const onHover = vi.fn();
    const connectors = [createConnector({ threadId: "t1" })];

    const { container } = render(
      <LassoOverlay
        connectors={connectors}
        highlightedThreadId={null}
        onHover={onHover}
      />
    );

    const hoverPath = container.querySelector(".lasso-connector-hover");
    if (hoverPath) {
      fireEvent.mouseEnter(hoverPath);
      fireEvent.mouseLeave(hoverPath);
    }

    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("renders anchor circle at start position", () => {
    const connectors = [createConnector({ startX: 150, startY: 75 })];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    const circle = container.querySelector(".lasso-anchor");
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute("cx", "150");
    expect(circle).toHaveAttribute("cy", "75");
  });

  it("applies highlighted class to anchor when highlighted", () => {
    const connectors = [createConnector({ threadId: "t1" })];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId="t1" />
    );

    const anchor = container.querySelector(".lasso-anchor--highlighted");
    expect(anchor).toBeInTheDocument();
  });

  it("has aria-hidden on SVG for accessibility", () => {
    const connectors = [createConnector()];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("generates bezier path with control points", () => {
    const connectors = [
      createConnector({ startX: 0, startY: 0, endX: 100, endY: 100 }),
    ];

    const { container } = render(
      <LassoOverlay connectors={connectors} highlightedThreadId={null} />
    );

    const path = container.querySelector(".lasso-connector");
    const d = path?.getAttribute("d");
    expect(d).toMatch(/^M \d+ \d+ C/); // Bezier curve path
  });
});
