import { describe, expect, it } from "vitest";
import { LOGIC_IMMO_PORTAL } from "./config.js";
import {
  buildClassifiedImageUrl,
  classifiedImageNeedsRefresh,
  normalizeAvivImageUrl,
} from "./helpers.js";

describe("buildClassifiedImageUrl", () => {
  it("keeps signed mms URLs from the scrape payload", () => {
    const signed =
      "https://mms.logic-immo.com/2/9/a/4/photo.jpg?ci_seal=abc123";
    expect(buildClassifiedImageUrl(LOGIC_IMMO_PORTAL, signed)).toBe(signed);
  });

  it("prefixes relative paths with the portal image host", () => {
    expect(
      buildClassifiedImageUrl(LOGIC_IMMO_PORTAL, "2/9/a/4/photo.jpg")
    ).toBe("https://mms.seloger.com/2/9/a/4/photo.jpg");
  });

  it("keeps unrelated image hosts unchanged", () => {
    const url = "https://img.leboncoin.fr/api/v1/lbcpb1/images/abc";
    expect(buildClassifiedImageUrl(LOGIC_IMMO_PORTAL, url)).toBe(url);
  });
});

describe("classifiedImageNeedsRefresh", () => {
  it("detects legacy resize URLs and unsigned mms URLs", () => {
    expect(
      classifiedImageNeedsRefresh(
        "https://v.seloger.com/s/width/800/6/a/0/4/photo.jpg"
      )
    ).toBe(true);
    expect(
      classifiedImageNeedsRefresh("https://mms.seloger.com/6/a/0/4/photo.jpg")
    ).toBe(true);
    expect(
      classifiedImageNeedsRefresh(
        "https://mms.logic-immo.com/6/a/0/4/photo.jpg?ci_seal=token"
      )
    ).toBe(false);
  });
});

describe("normalizeAvivImageUrl", () => {
  it("preserves signed social preview URLs for Discord", () => {
    const signed =
      "https://mms.logic-immo.com/6/a/0/4/photo.jpg?ci_seal=signed-token";
    expect(normalizeAvivImageUrl(signed)).toBe(signed);
  });
});
