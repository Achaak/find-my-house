import { describe, expect, it } from "vitest";
import {
  extractPostalCodeFromAddress,
  mapLegacyLine,
  mapRecentLine,
  parseGeopoint,
} from "./ademeDpeMappers.js";

describe("ademeDpeMappers", () => {
  it("parses geopoints", () => {
    expect(parseGeopoint("48.8566,2.3522")).toEqual({
      lat: 48.8566,
      lng: 2.3522,
    });
    expect(parseGeopoint("invalid")).toBeNull();
  });

  it("extracts postal codes from free-form addresses", () => {
    expect(extractPostalCodeFromAddress("12 rue de Rivoli 75001 Paris")).toBe(
      "75001"
    );
    expect(extractPostalCodeFromAddress("Sans code postal")).toBeNull();
  });

  it("maps recent ADEME lines", () => {
    const result = mapRecentLine({
      numero_dpe: "1234567890123A",
      adresse_ban: "12 rue de Rivoli 75001 Paris",
      code_postal_ban: "75001",
      etiquette_dpe: "C",
      etiquette_ges: "D",
      surface_habitable_logement: 95,
      _geopoint: "48.8566,2.3522",
    });

    expect(result).toMatchObject({
      numeroDpe: "1234567890123A",
      postalCode: "75001",
      dpeClass: "C",
      gesClass: "D",
      surfaceM2: 95,
      latitude: 48.8566,
      longitude: 2.3522,
      dataset: "recent",
    });
  });

  it("maps legacy ADEME lines", () => {
    const result = mapLegacyLine({
      numero_dpe: "LEGACY-1",
      geo_adresse: "5 avenue Foch 69001 Lyon",
      classe_consommation_energie: "B",
      surface_thermique_lot: 110,
      latitude: 45.764,
      longitude: 4.8357,
    });

    expect(result).toMatchObject({
      numeroDpe: "LEGACY-1",
      postalCode: "69001",
      dpeClass: "B",
      surfaceM2: 110,
      dataset: "legacy",
    });
  });

  it("returns null when numero_dpe is missing", () => {
    expect(mapRecentLine({ adresse_ban: "Sans numéro" })).toBeNull();
    expect(mapLegacyLine({ geo_adresse: "Sans numéro" })).toBeNull();
  });
});
