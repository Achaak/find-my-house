import { describe, expect, it } from "vitest";
import type { LeboncoinAd } from "../client.js";
import { parseLeboncoinDetailHtml } from "./detailHtml.js";
import {
  describeLeboncoinHtmlFailure,
  isLeboncoinAccessBlockedHtml,
} from "./htmlDiagnostics.js";

const sampleAd: LeboncoinAd = {
  list_id: 123,
  subject: "Maison 5 pièces",
  body: "Belle maison",
  url: "https://www.leboncoin.fr/ad/ventes_immobilieres/123",
  price: [250_000],
  attributes: [],
  location: { city: "Paris", lat: 48.85, lng: 2.35 },
};

function wrapNextData(ad: LeboncoinAd): string {
  return `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    { props: { pageProps: { ad } } }
  )}</script></body></html>`;
}

describe("parseLeboncoinDetailHtml", () => {
  it("extracts ad data from __NEXT_DATA__", () => {
    const ad = parseLeboncoinDetailHtml(wrapNextData(sampleAd));
    expect(ad.list_id).toBe(123);
    expect(ad.subject).toBe("Maison 5 pièces");
  });

  it("reports blocked pages clearly", () => {
    expect(() =>
      parseLeboncoinDetailHtml(
        "<html><title>leboncoin.fr</title>datadome</html>"
      )
    ).toThrow(/anti-bot/);
  });
});

describe("htmlDiagnostics", () => {
  it("detects DataDome block pages", () => {
    expect(isLeboncoinAccessBlockedHtml("<html>datadome captcha</html>")).toBe(
      true
    );
    expect(describeLeboncoinHtmlFailure("<html>datadome</html>")).toContain(
      "anti-bot"
    );
  });
});
