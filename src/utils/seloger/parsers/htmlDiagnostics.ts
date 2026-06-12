/** Explains why SeLoger search HTML could not be parsed (for error messages). */
export function describeSeLogerSearchHtmlFailure(html: string): string {
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
  if (title) {
    return `JSON embarqué absent (titre: « ${title} »)`;
  }

  return "HTML sans données de recherche";
}
