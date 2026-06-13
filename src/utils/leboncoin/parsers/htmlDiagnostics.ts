export function isLeboncoinAccessBlockedHtml(html: string): boolean {
  return (
    /datadome/i.test(html) ||
    /captcha-delivery/i.test(html) ||
    /vous avez été bloqué/i.test(html)
  );
}

/** True when HTML looks like a block page or shell without listing data. */
export function isIncompleteLeboncoinSearchHtml(html: string): boolean {
  if (isLeboncoinAccessBlockedHtml(html)) return true;
  if (html.includes("__NEXT_DATA__")) return false;
  return html.length < 10_000;
}

export function describeLeboncoinHtmlFailure(html: string): string {
  if (isLeboncoinAccessBlockedHtml(html)) {
    return "page de protection anti-bot détectée";
  }

  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  if (title === "leboncoin.fr") {
    return "page coquille sans données (timeout ou blocage)";
  }

  if (!html.includes("__NEXT_DATA__")) {
    return "balise __NEXT_DATA__ absente";
  }

  return "structure de page inattendue";
}
