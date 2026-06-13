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
    return "anti-bot protection page detected";
  }

  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  if (title === "leboncoin.fr") {
    return "empty shell page with no data (timeout or block)";
  }

  if (!html.includes("__NEXT_DATA__")) {
    return "__NEXT_DATA__ tag missing";
  }

  return "unexpected page structure";
}
