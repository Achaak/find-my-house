import { describe, expect, it } from "vitest";
import { parseBieniciAgency } from "./agency.js";

describe("parseBieniciAgency", () => {
  it("parses multi-part agency prefixes", () => {
    expect(parseBieniciAgency("iad-france-936123")).toEqual({
      agencySlug: "iad-france",
      agencyRef: "936123",
    });
    expect(parseBieniciAgency("century-21-202_2922_7278")).toEqual({
      agencySlug: "century-21",
      agencyRef: "202_2922_7278",
    });
    expect(parseBieniciAgency("dr-house-immo-1-3138859")).toEqual({
      agencySlug: "dr-house-immo-1",
      agencyRef: "3138859",
    });
  });

  it("parses ag-prefixed agencies", () => {
    expect(parseBieniciAgency("ag440414-528372851")).toEqual({
      agencySlug: "ag440414",
      agencyRef: "528372851",
    });
  });

  it("parses single-word agencies", () => {
    expect(parseBieniciAgency("netty-company56750yvp-house-330")).toEqual({
      agencySlug: "netty",
      agencyRef: "company56750yvp-house-330",
    });
    expect(parseBieniciAgency("hektor-FOCHhavre-428")).toEqual({
      agencySlug: "hektor",
      agencyRef: "FOCHhavre-428",
    });
  });
});
