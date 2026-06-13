import type { ClassifiedPortalConfig } from "../types.js";

function hasEmbeddedSearchData(html: string): boolean {
  return (
    html.includes('window["initialData"]') ||
    html.includes("classified-serp-init-data")
  );
}

/** True when the HTML looks truncated or is a shell page without listing data. */
export function isIncompleteClassifiedSearchHtml(html: string): boolean {
  if (/504\s+Gateway\s+Time-?out/i.test(html)) {
    return true;
  }

  if (hasEmbeddedSearchData(html)) {
    return false;
  }

  if (
    html.includes("__UFRN_FETCHER__") &&
    (html.includes('"data":{}') || html.includes('"data": {}'))
  ) {
    return true;
  }

  if (html.length > 50_000) {
    return !html.includes("__UFRN_FETCHER__") || !/<\/html>/i.test(html);
  }

  return false;
}

/** Explains why classified search HTML could not be parsed (for error messages). */
export function describeClassifiedSearchHtmlFailure(
  portal: ClassifiedPortalConfig,
  html: string
): string {
  if (/504\s+Gateway\s+Time-?out/i.test(html)) {
    return "timeout nginx (504) — réessayez plus tard";
  }

  if (
    /datadome/i.test(html) ||
    /captcha/i.test(html) ||
    /access denied/i.test(html)
  ) {
    return "page de protection anti-bot détectée";
  }

  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();

  if (title === portal.label || title === "SeLoger") {
    return "page coquille sans résultats (timeout ou surcharge serveur) — réessayez";
  }

  if (isIncompleteClassifiedSearchHtml(html)) {
    return "réponse HTML incomplète (connexion interrompue ou timeout)";
  }

  if (title) {
    return `JSON embarqué absent (titre: « ${title} »)`;
  }

  return `HTML ${portal.label} sans données de recherche`;
}
