const MULTI_PART_AGENCY_PREFIXES = [
  "square-habitat-immo-facile",
  "laforet-immo-facile",
  "dr-house-immo-1",
  "century-21",
  "iad-france",
  "immo-facile",
  "adapt-immo",
  "safti-1",
] as const;

export type BieniciAgencyIdentity = {
  agencySlug: string;
  agencyRef: string;
};

export function parseBieniciAgency(
  externalId: string
): BieniciAgencyIdentity | null {
  const normalized = externalId.trim();
  if (!normalized) return null;

  for (const prefix of MULTI_PART_AGENCY_PREFIXES) {
    const marker = `${prefix}-`;
    if (normalized.startsWith(marker)) {
      const agencyRef = normalized.slice(marker.length);
      return agencyRef ? { agencySlug: prefix, agencyRef } : null;
    }
  }

  const agMatch = /^(ag\d+)-(.+)$/.exec(normalized);
  if (agMatch?.[1] && agMatch[2]) {
    return { agencySlug: agMatch[1], agencyRef: agMatch[2] };
  }

  const firstDash = normalized.indexOf("-");
  if (firstDash === -1) return null;

  const agencySlug = normalized.slice(0, firstDash);
  const agencyRef = normalized.slice(firstDash + 1);
  if (!agencySlug || !agencyRef) return null;

  return { agencySlug, agencyRef };
}
