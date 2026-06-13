import { describe, expect, it } from "vitest";
import { parseClassifiedOgImageFromHtml } from "./ogImage.js";

describe("parseClassifiedOgImageFromHtml", () => {
  it("extracts og:image from detail page metadata", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://mms.logic-immo.com/6/a/0/4/photo.jpg?ci_seal=abc">
    </head></html>`;

    expect(parseClassifiedOgImageFromHtml(html)).toBe(
      "https://mms.logic-immo.com/6/a/0/4/photo.jpg?ci_seal=abc"
    );
  });
});
