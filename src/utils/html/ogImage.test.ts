import { describe, expect, it } from "vitest";
import { parseOgImageFromHtml } from "./ogImage.js";

describe("parseOgImageFromHtml", () => {
  it("extracts og:image when property precedes content", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://mms.logic-immo.com/6/a/0/4/photo.jpg?ci_seal=abc">
    </head></html>`;

    expect(parseOgImageFromHtml(html)).toBe(
      "https://mms.logic-immo.com/6/a/0/4/photo.jpg?ci_seal=abc"
    );
  });

  it("extracts og:image when content precedes property", () => {
    const html = `<meta content="https://img.leboncoin.fr/photo.jpg" property="og:image">`;

    expect(parseOgImageFromHtml(html)).toBe(
      "https://img.leboncoin.fr/photo.jpg"
    );
  });

  it("returns null when og:image is missing", () => {
    expect(parseOgImageFromHtml("<html><head></head></html>")).toBeNull();
  });
});
