import { describe, expect, it } from "vitest";
import { diagnosticsEmptyMessage } from "./property-match-diagnostics-ui";

describe("diagnosticsEmptyMessage", () => {
  it("returns initial empty-state when nothing was loaded", () => {
    expect(diagnosticsEmptyMessage(false, null)).toBe(
      "No diagnostics loaded yet."
    );
  });

  it("returns preset-specific empty-state messages", () => {
    expect(diagnosticsEmptyMessage(true, "price")).toBe(
      "No price veto diagnostics found for this filter set."
    );
    expect(diagnosticsEmptyMessage(true, "last24h")).toBe(
      "No diagnostics found in the last 24 hours."
    );
    expect(diagnosticsEmptyMessage(true, "bienici")).toBe(
      "No Bienici diagnostics found for this filter set."
    );
  });

  it("falls back to generic loaded-empty message", () => {
    expect(diagnosticsEmptyMessage(true, "custom")).toBe(
      "No diagnostics found for this filter set."
    );
    expect(diagnosticsEmptyMessage(true, null)).toBe(
      "No diagnostics found for this filter set."
    );
  });
});
