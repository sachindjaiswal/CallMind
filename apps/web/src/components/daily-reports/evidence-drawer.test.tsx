// @vitest-environment jsdom
import type { ReportEvidence } from "@callmind/shared";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceDrawer } from "./evidence-drawer";

afterEach(cleanup);

function evidence(overrides: Partial<ReportEvidence> = {}): ReportEvidence {
  return {
    insightId: "insight-1",
    analysisId: "analysis-1",
    recordingId: "recording-1",
    segmentId: "seg-1",
    segmentIndex: 1,
    start: 4,
    end: 9,
    quote: "we agreed to ship on Friday",
    ...overrides,
  };
}

describe("evidence drawer", () => {
  it("invokes onOpenSourceRecording with the complete evidence object", () => {
    const item = evidence();
    const onOpenSourceRecording = vi.fn();
    render(
      <EvidenceDrawer
        evidence={[item]}
        onClose={() => undefined}
        onOpenSourceRecording={onOpenSourceRecording}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /open source recording/i }),
    );

    expect(onOpenSourceRecording).toHaveBeenCalledTimes(1);
    expect(onOpenSourceRecording).toHaveBeenCalledWith(item);
  });

  it("preserves compatibility with callers that do not pass the callback", () => {
    const onClose = vi.fn();
    render(<EvidenceDrawer evidence={[evidence()]} onClose={onClose} />);

    expect(
      screen.queryByRole("button", { name: /open source recording/i }),
    ).toBeNull();
    expect(
      screen.getByText(/we agreed to ship on Friday/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /close evidence/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deduplicates repeated excerpts", () => {
    render(
      <EvidenceDrawer
        evidence={[
          evidence(),
          evidence(),
          evidence({ segmentId: "seg-2", segmentIndex: 2, quote: "second" }),
        ]}
        onClose={() => undefined}
        onOpenSourceRecording={() => undefined}
      />,
    );

    expect(screen.getByText("2 linked transcript excerpts")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /open source recording/i }),
    ).toHaveLength(2);
  });

  it("exposes dialog semantics and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <EvidenceDrawer evidence={[evidence()]} onClose={onClose} />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")
        ?.textContent,
    ).toBe("Evidence");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps keyboard focus inside the dialog", () => {
    render(
      <EvidenceDrawer
        evidence={[evidence()]}
        onClose={() => undefined}
        onOpenSourceRecording={() => undefined}
      />,
    );

    const openButton = screen.getByRole("button", {
      name: /open source recording/i,
    });
    const closeButton = screen.getByRole("button", {
      name: /close evidence/i,
    });
    openButton.focus();
    expect(document.activeElement).toBe(openButton);

    fireEvent.keyDown(openButton, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  it("does not render the action for evidence without a recording id", () => {
    render(
      <EvidenceDrawer
        evidence={[evidence({ recordingId: "  " })]}
        onClose={() => undefined}
        onOpenSourceRecording={() => undefined}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /open source recording/i }),
    ).toBeNull();
  });
});
