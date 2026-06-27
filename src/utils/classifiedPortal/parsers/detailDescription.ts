import { pickLongestDescription } from "../../../domain/descriptionEquivalence.js";

function decodeEscapedJsonString(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeDescriptionText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAIN_DESCRIPTION_JSON_PATTERNS = [
  /mainDescription\\":\{\\"headline\\":\\"(?:\\.|[^"\\])*\\",\\"description\\":\\"((?:\\.|[^"\\])*)\\"/g,
  /"mainDescription":\{"headline":"(?:\\.|[^"\\])*","description":"((?:\\.|[^"\\])*)"/g,
  /mainDescription\\":\{\\"description\\":\\"((?:\\.|[^"\\])*)\\"/g,
] as const;

function isPlausibleListingDescription(description: string): boolean {
  if (description.length < 40) return false;
  if (/","canonical"|\\"/.test(description)) return false;
  if (
    /^Achat (?:Maison|Appartement) .*\d[\d\s.]*\s*€.*\(\d{5}\)$/u.test(
      description.replace(/\s+/g, " ").trim()
    )
  ) {
    return false;
  }
  return true;
}

function extractClassifiedDescriptionFromDom(html: string): string | null {
  const match =
    /data-testid="cdp-main-description-expandable-text"[^>]*>([\s\S]*?)<\//i.exec(
      html
    );
  if (!match) return null;

  const text = normalizeDescriptionText(stripHtmlTags(match[1]));
  return isPlausibleListingDescription(text) ? text : null;
}

function extractClassifiedDescriptionFromJson(html: string): string | null {
  let longest: string | null = null;

  for (const pattern of MAIN_DESCRIPTION_JSON_PATTERNS) {
    for (const match of html.matchAll(pattern)) {
      const decoded = normalizeDescriptionText(
        decodeEscapedJsonString(match[1])
      );
      if (!isPlausibleListingDescription(decoded)) continue;
      if (!longest || decoded.length > longest.length) {
        longest = decoded;
      }
    }
  }

  return longest;
}

export function extractClassifiedMainDescriptionFromHtml(
  html: string
): string | null {
  return pickLongestDescription([
    extractClassifiedDescriptionFromDom(html),
    extractClassifiedDescriptionFromJson(html),
  ]);
}

export function isTruncatedPortalDescription(
  description: string | null | undefined
): boolean {
  const trimmed = description?.trim();
  if (!trimmed) return true;
  if (/","canonical"|\\"/.test(trimmed)) return true;
  return /(?:\.\.\.|…)$/.test(trimmed);
}
