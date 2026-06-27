import { describe, expect, it } from "vitest";
import {
  descriptionsAreEquivalent,
  pickLongestDescription,
} from "./descriptionEquivalence.js";

describe("pickLongestDescription", () => {
  it("returns the longest non-empty description", () => {
    expect(
      pickLongestDescription([
        "Short text",
        "Much longer description with more detail",
        null,
      ])
    ).toBe("Much longer description with more detail");
  });
});

describe("descriptionsAreEquivalent", () => {
  it("treats prefix variants as equivalent", () => {
    const long =
      "En Vente uniquement dans notre Agence ! Axe Bolbec - suite du texte";
    const short = "En Vente uniquement dans notre Agence ! Axe Bolbec -";

    expect(descriptionsAreEquivalent(long, short)).toBe(true);
  });

  it("detects genuinely different descriptions", () => {
    expect(
      descriptionsAreEquivalent("Maison familiale", "Appartement centre-ville")
    ).toBe(false);
  });

  it("treats truncated portal excerpts as equivalent to the full text", () => {
    const full =
      "Propriété 6 pièces 150 m² En Vente uniquement dans notre Agence ! Axe Bolbec suite complète";
    const truncated =
      "En Vente uniquement dans notre Agence ! Axe Bolbec suite comp...";

    expect(descriptionsAreEquivalent(full, truncated)).toBe(true);
  });
});
