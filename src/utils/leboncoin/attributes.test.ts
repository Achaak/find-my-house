import { describe, expect, it } from "vitest";
import type { LeboncoinAd } from "./client.js";
import { extractLeboncoinListingExtras } from "./attributes.js";

function makeAd(attributes: LeboncoinAd["attributes"]): LeboncoinAd {
  return {
    list_id: 1,
    subject: "Maison",
    body: "",
    url: "https://www.leboncoin.fr/ad/1",
    price: [300_000],
    attributes,
    location: { city: "Lyon", lat: 45.75, lng: 4.85 },
  };
}

describe("extractLeboncoinListingExtras", () => {
  it("extracts amenities visible on listing cards", () => {
    const extras = extractLeboncoinListingExtras(
      makeAd([
        { key: "nb_bathrooms", value: "2", value_label: "2" },
        { key: "building_year", value: "1975", value_label: "1975" },
        {
          key: "global_condition",
          value: "5",
          value_label: "Travaux à prévoir",
        },
        { key: "nb_parkings", value: "2", value_label: "2" },
        { key: "heating", value: "gas", value_label: "Gaz" },
        { key: "orientation", value: "south", value_label: "Sud" },
        {
          key: "specificities",
          value: "",
          value_label: "Garage, Cave, Cuisine équipée",
        },
        { key: "outside_access", value: "", value_label: "Jardin" },
      ])
    );

    expect(extras).toEqual({
      bathrooms: 2,
      constructionYear: 1975,
      heating: "Gaz",
      orientation: "Sud",
      propertyCondition: "Travaux à prévoir",
      parkingSpaces: 2,
      highlights: ["Garage", "Cave", "Cuisine équipée", "Jardin"],
    });
  });
});
