import { describe, expect, it } from "vitest";
import {
  groupByFuzzyPropertyMatch,
  groupByStrictPropertyKey,
  toPropertyMatchInput,
} from "./propertyDedup.js";

describe("propertyDedup", () => {
  it("groups properties with the same strict key", () => {
    const items = [
      {
        id: 1,
        ...toPropertyMatchInput({
          postalCode: "76160",
          price: 300_000,
          surface: 90,
          rooms: 5,
          bedrooms: 3,
          landSurface: 500,
          propertyType: "house",
          isNewProperty: false,
        }),
      },
      {
        id: 2,
        ...toPropertyMatchInput({
          postalCode: "76160",
          price: 300_000,
          surface: 90,
          rooms: 5,
          bedrooms: 3,
          landSurface: 500,
          propertyType: "house",
          isNewProperty: false,
        }),
      },
      {
        id: 3,
        ...toPropertyMatchInput({
          postalCode: "76160",
          price: 400_000,
          surface: 90,
          rooms: 5,
          bedrooms: 3,
          landSurface: 500,
          propertyType: "house",
          isNewProperty: false,
        }),
      },
    ];

    const groups = groupByStrictPropertyKey(items, (item) =>
      toPropertyMatchInput(item)
    );
    const duplicateGroup = [...groups.values()].find(
      (group) => group.length === 2
    );

    expect(duplicateGroup?.map((entry) => entry.id).sort()).toEqual([1, 2]);
  });

  it("groups fuzzy matches within the same postal code", () => {
    const items = [
      {
        id: 10,
        ...toPropertyMatchInput({
          postalCode: "76160",
          price: 300_000,
          surface: 90,
          rooms: 5,
          bedrooms: 3,
          landSurface: 500,
          propertyType: "house",
          isNewProperty: false,
        }),
      },
      {
        id: 11,
        ...toPropertyMatchInput({
          postalCode: "76160",
          price: 302_000,
          surface: 90,
          rooms: 5,
          bedrooms: 3,
          landSurface: 500,
          propertyType: "house",
          isNewProperty: false,
        }),
      },
    ];

    const groups = groupByFuzzyPropertyMatch(items, (item) =>
      toPropertyMatchInput(item)
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((entry) => entry.id).sort()).toEqual([10, 11]);
  });
});
