import * as m from "@/paraglide/messages.js";

export type DiagnosticsPreset =
  | "price"
  | "last24h"
  | "bienici"
  | "custom"
  | null;

export function diagnosticsEmptyMessage(
  hasLoadedDiagnostics: boolean,
  activePreset: DiagnosticsPreset
): string {
  if (!hasLoadedDiagnostics) {
    return m.admin_diag_empty_none();
  }
  if (activePreset === "price") {
    return m.admin_diag_empty_price();
  }
  if (activePreset === "last24h") {
    return m.admin_diag_empty_last24h();
  }
  if (activePreset === "bienici") {
    return m.admin_diag_empty_bienici();
  }
  return m.admin_diag_empty_default();
}
