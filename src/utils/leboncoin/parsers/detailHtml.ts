import type { LeboncoinAd } from "../client.js";
import { describeLeboncoinHtmlFailure } from "./htmlDiagnostics.js";
import { extractNextData } from "./nextData.js";

export function parseLeboncoinDetailHtml(html: string): LeboncoinAd {
  const data = extractNextData(html) as {
    props?: { pageProps?: { ad?: LeboncoinAd } };
  } | null;
  const ad = data?.props?.pageProps?.ad;
  if (ad) return ad;

  throw new Error(
    `LeBonCoin: annonce introuvable — ${describeLeboncoinHtmlFailure(html)}`
  );
}
