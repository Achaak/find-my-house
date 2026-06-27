import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applySeLogerSearchMetadata,
  describeSeLogerSearchHtmlFailure,
  extractSeLogerCoordsFromClassifiedData,
  parseSeLogerCoordinatesFromHtml,
  parseSeLogerDetailEnergy,
  parseSeLogerDetailPage,
  parseSeLogerSearchHtml,
  type SeLogerClassifiedCard,
} from "../seloger/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("applySeLogerSearchMetadata", () => {
  it("fills missing DPE/GES classes from card text", () => {
    const card: SeLogerClassifiedCard = {
      id: "123",
      cardType: "classified",
      description: "Belle maison. Classe énergie C, Classe climat D",
    };

    const enriched = applySeLogerSearchMetadata(card);

    expect(enriched.energyClass).toBe("C");
    expect(enriched.gesClass).toBe("D");
  });

  it("fills land surface from keyfacts when available on search cards", () => {
    const card: SeLogerClassifiedCard = {
      id: "123",
      cardType: "classified",
      tags: ["Terrain de 1 200 m²"],
    };

    expect(applySeLogerSearchMetadata(card).landSurface).toBe(1200);
  });
});

describe("parseSeLogerRooms", () => {
  it("maps rooms from tags when search cards omit nbroom", async () => {
    const { mapSeLogerCardToListing } = await import("../seloger/index.js");

    const listing = mapSeLogerCardToListing(
      {
        id: "tag-rooms",
        cardType: "classified",
        pricing: { rawPrice: "350000" },
        tags: ["6 pièces", "4 chambres"],
        cityLabel: "Lyon",
      },
      "2026-01-01T00:00:00.000Z",
      "Lyon"
    );

    expect(listing.rooms).toBe(6);
    expect(listing.bedrooms).toBe(4);
  });
});

describe("parseSeLogerDetailEnergy", () => {
  it("extracts classes and metrics from detail HTML", () => {
    const html = `
      <html>
        <body>
          Classe énergie C, Classe climat D
          Consommation énergétique : 150 kWh/m².an
          Émissions : 25 kg CO₂/m²
        </body>
      </html>
    `;

    expect(parseSeLogerDetailEnergy(html)).toEqual({
      dpeClass: "C",
      gesClass: "D",
      dpeConsumptionKwhM2: 150,
      gesEmissionKgM2: 25,
    });
  });
});

describe("describeSeLogerSearchHtmlFailure", () => {
  it("detects nginx 504 pages", () => {
    expect(
      describeSeLogerSearchHtmlFailure(
        "<html><head><title>504 Gateway Time-out</title></head></html>"
      )
    ).toContain("504");
  });

  it("describes shell pages with the generic SeLoger title", () => {
    expect(
      describeSeLogerSearchHtmlFailure("<html><title>SeLoger</title></html>")
    ).toContain("empty shell page");
  });

  it("includes the page title when present", () => {
    expect(
      describeSeLogerSearchHtmlFailure("<html><title>Just a moment</title>")
    ).toContain("Just a moment");
  });
});

describe("parseSeLogerSearchHtml", () => {
  it("throws a descriptive error for unparseable HTML", () => {
    expect(() =>
      parseSeLogerSearchHtml("<html><title>Blocked</title></html>")
    ).toThrow(/Blocked/);
  });

  it("throws a descriptive error when UFRN has no search payload", () => {
    expect(() =>
      parseSeLogerSearchHtml(`
        <html><title>SeLoger</title>
        <script id="__UFRN_FETCHER__">window["__UFRN_FETCHER__"]=JSON.parse("{\\"data\\":{},\\"errors\\":{}}");</script>
        </html>
      `)
    ).toThrow(/empty shell page/);
  });

  it("parses listings from embedded initialData JSON", () => {
    const result = parseSeLogerSearchHtml(
      readFixture("search-initial-data.html")
    );

    expect(result.totalCount).toBe(1);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.id).toBe("abc123");
  });

  it("parses listings from UFRN fetcher HTML", () => {
    const result = parseSeLogerSearchHtml(
      readFixture("search-ufrn-fetcher.html")
    );

    expect(result.totalCount).toBe(1);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.title).toBe("Maison de ville");
    expect(result.cards[0]?.zipCode).toBe("69003");
    expect(result.cards[0]?.landSurface).toBe(800);
  });
});

describe("coordinates", () => {
  it("extracts coords from classified JSON", () => {
    const coords = extractSeLogerCoordsFromClassifiedData({
      location: {
        coordinates: { latitude: 47.2184, longitude: -1.5536 },
      },
    });

    expect(coords).toEqual({ lat: 47.2184, lng: -1.5536 });
  });

  it("parses coords from Mapbox static map URL", () => {
    const coords = parseSeLogerCoordinatesFromHtml(
      readFixture("detail-mapbox-fallback.html")
    );

    expect(coords).toEqual({ lat: 48.8566, lng: 2.3522 });
  });
});

describe("parseSeLogerDetailPage", () => {
  it("returns coords and listing fields from embedded classified data", () => {
    const details = parseSeLogerDetailPage(
      readFixture("detail-with-coordinates.html")
    );

    expect(details.latitude).toBe(47.2184);
    expect(details.longitude).toBe(-1.5536);
    expect(details.description).toContain("Belle maison");
    expect(details.landSurface).toBe(500);
    expect(details.dpeClass).toBe("C");
    expect(details.gesClass).toBe("D");
  });

  it("falls back to Mapbox URL when classified JSON has no coords", () => {
    const details = parseSeLogerDetailPage(
      readFixture("detail-mapbox-fallback.html")
    );

    expect(details.latitude).toBe(48.8566);
    expect(details.longitude).toBe(2.3522);
  });
});
