import { describe, expect, it } from "vitest";
import {
  filterClassifiedCardsByPostalCode,
  filterClassifiedCardsBySearchUrl,
} from "./searchApi.js";

describe("filterClassifiedCardsBySearchUrl", () => {
  it("can drop cards when criteria fields are present on previews", () => {
    const url =
      "https://www.seloger.com/classified-search?priceMax=300000&spaceMin=90&plotSpaceMin=1000&numberOfRoomsMin=4&numberOfBedroomsMin=3&projectTypes=Resale";
    const cards = [
      { id: "1", pricing: { rawPrice: "250000" }, surface: 100, rooms: 5 },
      { id: "2", pricing: { rawPrice: "350000" }, surface: 100, rooms: 5 },
    ];

    expect(filterClassifiedCardsBySearchUrl(cards, url)).toEqual([
      { id: "1", pricing: { rawPrice: "250000" }, surface: 100, rooms: 5 },
    ]);
  });
});

describe("filterClassifiedCardsByPostalCode", () => {
  it("drops listings from other communes when zipCode is known", () => {
    const cards = [
      { id: "1", zipCode: "69001" },
      { id: "2", zipCode: "69002" },
      { id: "3" },
    ];

    expect(filterClassifiedCardsByPostalCode(cards, "69001")).toEqual([
      { id: "1", zipCode: "69001" },
      { id: "3" },
    ]);
  });
});
