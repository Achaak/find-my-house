import { describe, expect, it } from "vitest";
import * as m from "@/paraglide/messages.js";
import { diagnosticsEmptyMessage } from "./property-match-diagnostics-ui";

describe("diagnosticsEmptyMessage", () => {
  it("returns initial empty-state when nothing was loaded", () => {
    expect(diagnosticsEmptyMessage(false, null)).toBe(
      m.admin_diag_empty_none()
    );
  });

  it("returns preset-specific empty-state messages", () => {
    expect(diagnosticsEmptyMessage(true, "price")).toBe(
      m.admin_diag_empty_price()
    );
    expect(diagnosticsEmptyMessage(true, "last24h")).toBe(
      m.admin_diag_empty_last24h()
    );
    expect(diagnosticsEmptyMessage(true, "bienici")).toBe(
      m.admin_diag_empty_bienici()
    );
  });

  it("falls back to generic loaded-empty message", () => {
    expect(diagnosticsEmptyMessage(true, "custom")).toBe(
      m.admin_diag_empty_default()
    );
    expect(diagnosticsEmptyMessage(true, null)).toBe(
      m.admin_diag_empty_default()
    );
  });
});
