import { describe, expect, it } from "vitest";
import { LOGIC_IMMO_PORTAL } from "../config.js";
import { parseClassifiedSearchHtml } from "./searchHtml.js";

describe("parseClassifiedSearchHtml", () => {
  it("extracts photos from initialData cards that only expose gallery images", () => {
    const html = `<script>
      window["initialData"]=JSON.parse("{\\"cards\\":{\\"list\\":[{\\"cardType\\":\\"classified\\",\\"id\\":\\"abc123\\",\\"title\\":\\"Maison\\",\\"gallery\\":{\\"images\\":[{\\"url\\":\\"https://mms.logic-immo.com/a/b/c/photo.jpg?ci_seal=xyz\\"}]}}]},\\"navigation\\":{\\"counts\\":{\\"count\\":1},\\"pagination\\":{\\"resultsPerPage\\":35}}}");
    </script>`;

    const result = parseClassifiedSearchHtml(LOGIC_IMMO_PORTAL, html);

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.photos).toEqual([
      "https://mms.logic-immo.com/a/b/c/photo.jpg?ci_seal=xyz",
    ]);
  });
});
