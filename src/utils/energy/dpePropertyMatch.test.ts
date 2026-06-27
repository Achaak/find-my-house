import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import type { DpeSearchResult } from "./ademeDpeMappers.js";
import {
  buildAdemeSearchParamVariants,
  buildSurfaceRange,
  extractPlaceHints,
  getDpeAddressSearchReadiness,
  isDpeCandidateEligible,
  rankDpeCandidates,
  scoreDpeCandidate,
  SURFACE_API_MARGIN_RATIO,
} from "./dpePropertyMatch.js";

function makeCandidate(
  overrides: Partial<DpeSearchResult> = {}
): DpeSearchResult {
  return {
    numeroDpe: "1234567890123A",
    address: "12 route de la Gauterie 44119 Grandchamps-des-Fontaines",
    postalCode: "44119",
    departmentCode: "44",
    dpeClass: "C",
    gesClass: "D",
    surfaceM2: 105,
    constructionYear: 1985,
    consumptionKwhM2Year: 178,
    emissionGesKgM2Year: 42,
    establishmentDate: "2024-06-01",
    expiryDate: null,
    buildingType: "Maison individuelle",
    addressMatchScore: null,
    latitude: 47.331,
    longitude: -1.612,
    dataset: "recent",
    ...overrides,
  };
}

describe("getDpeAddressSearchReadiness", () => {
  it("returns unavailable without DPE class or postal code", () => {
    expect(
      getDpeAddressSearchReadiness(
        makePropertyRow({ dpeClass: null, postalCode: "44119" })
      )
    ).toBe("unavailable");
    expect(
      getDpeAddressSearchReadiness(
        makePropertyRow({ dpeClass: "C", postalCode: null })
      )
    ).toBe("unavailable");
  });

  it("returns full when precise energy metrics exist", () => {
    expect(getDpeAddressSearchReadiness(makePropertyRow())).toBe("full");
    expect(
      getDpeAddressSearchReadiness(
        makePropertyRow({ gesEmissionKgM2: null, dpeConsumptionKwhM2: 178 })
      )
    ).toBe("full");
  });

  it("returns degraded for DPE letter only", () => {
    expect(
      getDpeAddressSearchReadiness(
        makePropertyRow({
          dpeConsumptionKwhM2: null,
          gesEmissionKgM2: null,
        })
      )
    ).toBe("degraded");
  });
});

describe("buildAdemeSearchParamVariants", () => {
  it("builds strict then relaxed variants without surface by default", () => {
    const variants = buildAdemeSearchParamVariants(
      makePropertyRow({
        postalCode: "44119",
        dpeClass: "C",
        gesClass: "D",
        dpeConsumptionKwhM2: 178,
        gesEmissionKgM2: 42,
        surface: 120,
      })
    );

    expect(variants.map((variant) => variant.id)).toEqual([
      "strict",
      "relaxed",
      "relaxed_no_ges",
      "relaxed_surface",
    ]);
    expect(variants[0].includeSurfaceFilter).toBe(false);
    expect(variants[0].params.recent.conso_5_usages_par_m2_ep_eq).toBe("178");
    expect(variants[0].params.recent.emission_ges_5_usages_par_m2_eq).toBe(
      "42"
    );
    expect(
      variants[0].params.recent.surface_habitable_logement_gte
    ).toBeUndefined();

    const surfaceVariant = variants.find(
      (variant) => variant.id === "relaxed_surface"
    );
    expect(surfaceVariant?.includeSurfaceFilter).toBe(true);
    const { min, max } = buildSurfaceRange(120, SURFACE_API_MARGIN_RATIO);
    expect(surfaceVariant?.params.recent.surface_habitable_logement_gte).toBe(
      String(min)
    );
    expect(surfaceVariant?.params.recent.surface_habitable_logement_lte).toBe(
      String(max)
    );
  });

  it("builds degraded variants without consumption filters", () => {
    const variants = buildAdemeSearchParamVariants(
      makePropertyRow({
        dpeConsumptionKwhM2: null,
        gesEmissionKgM2: null,
      })
    );

    expect(variants.map((variant) => variant.id)).toEqual([
      "degraded",
      "degraded_no_ges",
      "degraded_surface",
    ]);
    expect(
      variants[0].params.recent.conso_5_usages_par_m2_ep_eq
    ).toBeUndefined();
  });
});

describe("extractPlaceHints", () => {
  it("ignores listing city and picks up street hints from description", () => {
    const hints = extractPlaceHints(
      makePropertyRow({
        city: "Nantes",
        title: "Maison de charme",
        publications: [
          {
            ...makePropertyRow().publications[0],
            description:
              "Superbe longère - route de la Gauterie - proche commodités",
          },
        ],
      })
    );

    expect(hints).not.toContain("nantes");
    expect(hints.some((hint) => hint.includes("gauterie"))).toBe(true);
  });
});

describe("isDpeCandidateEligible", () => {
  it("does not reject candidates when listing surface differs from DPE habitable", () => {
    const property = makePropertyRow({
      postalCode: "44119",
      surface: 120,
      dpeConsumptionKwhM2: 178,
      gesEmissionKgM2: 42,
    });

    expect(
      isDpeCandidateEligible(property, makeCandidate({ surfaceM2: 105 }))
    ).toBe(true);
  });

  it("still rejects on DPE energy mismatch", () => {
    expect(
      isDpeCandidateEligible(
        makePropertyRow({ dpeConsumptionKwhM2: 178 }),
        makeCandidate({ consumptionKwhM2Year: 200 })
      )
    ).toBe(false);
  });
});

describe("scoreDpeCandidate", () => {
  it("boosts nearby coordinates without penalizing far candidates", () => {
    const property = makePropertyRow({
      latitude: 47.331,
      longitude: -1.612,
      dpeConsumptionKwhM2: 178,
      gesEmissionKgM2: 42,
    });

    const nearScore = scoreDpeCandidate(property, makeCandidate());
    const farScore = scoreDpeCandidate(
      property,
      makeCandidate({ latitude: 48.5, longitude: -2.0 })
    );

    expect(nearScore).toBeGreaterThan(farScore);
    expect(farScore).toBeGreaterThan(0);
  });
});

describe("rankDpeCandidates", () => {
  it("ranks closer geo matches above distant ones with same DPE profile", () => {
    const property = makePropertyRow({
      postalCode: "44119",
      latitude: 47.331,
      longitude: -1.612,
      dpeConsumptionKwhM2: 178,
      gesEmissionKgM2: 42,
      description: "route de la Gauterie",
    });

    const ranked = rankDpeCandidates(property, [
      makeCandidate({
        numeroDpe: "FAR-1",
        address: "5 rue Lointaine 44190 Clisson",
        latitude: 47.1,
        longitude: -1.28,
      }),
      makeCandidate({
        numeroDpe: "NEAR-1",
        address: "12 route de la Gauterie 44119 Grandchamps-des-Fontaines",
        latitude: 47.3312,
        longitude: -1.6121,
      }),
    ]);

    expect(ranked[0]?.numeroDpe).toBe("NEAR-1");
  });
});
