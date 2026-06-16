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
    return "No diagnostics loaded yet.";
  }
  if (activePreset === "price") {
    return "No price veto diagnostics found for this filter set.";
  }
  if (activePreset === "last24h") {
    return "No diagnostics found in the last 24 hours.";
  }
  if (activePreset === "bienici") {
    return "No Bienici diagnostics found for this filter set.";
  }
  return "No diagnostics found for this filter set.";
}
