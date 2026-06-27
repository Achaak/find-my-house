import { describe, expect, it } from "vitest";
import {
  extractClassifiedMainDescriptionFromHtml,
  isTruncatedPortalDescription,
} from "./detailDescription.js";

describe("extractClassifiedMainDescriptionFromHtml", () => {
  it("extracts full descriptions from the detail page DOM", () => {
    const html = `
      <div data-testid="cdp-main-description-expandable-text">
        Maison à vendre - Les Loges - 169 m² - 5 CHAMBRES<br><br>
        LEMAISTRE IMMOBILIER vous propose cette agréable maison située aux Loges.<br><br>
        Elle se compose d'une entrée, VASTE séjour salon, cuisine aménagée et équipée.
      </div>
    `;

    const description = extractClassifiedMainDescriptionFromHtml(html);

    expect(description).toContain("LEMAISTRE IMMOBILIER");
    expect(description).toContain("VASTE séjour salon");
    expect(description).not.toMatch(/\.\.\.$/);
  });

  it("extracts full descriptions from Next.js flight payloads", () => {
    const html = `
      self.__next_f.push([1,"mainDescription\\":{\\"headline\\":\\"Les Loges\\",\\"description\\":\\"Maison à vendre - Les Loges - 169 m² - 5 CHAMBRES\\\\n\\\\nLEMAISTRE IMMOBILIER vous propose cette agréable maison située aux Loges.\\\\n\\\\nElle se compose d'une entrée, VASTE séjour salon.\\"}"]);
    `;

    const description = extractClassifiedMainDescriptionFromHtml(html);

    expect(description).toContain("LEMAISTRE IMMOBILIER");
    expect(description).toContain("VASTE séjour salon");
  });

  it("prefers the DOM description over SEO JSON fragments", () => {
    const html = `
      mainDescription\\":{\\"headline\\":\\"Title\\",\\"description\\":\\"Achat Maison 6 pièces 169 m² 299000 € Les Loges (76790)\\",\\"canonical\\":\\"https://example.com\\"}
      <div data-testid="cdp-main-description-expandable-text">
        Maison à vendre - Les Loges - 169 m² - 5 CHAMBRES
        LEMAISTRE IMMOBILIER vous propose cette agréable maison.
      </div>
    `;

    expect(extractClassifiedMainDescriptionFromHtml(html)).toContain(
      "LEMAISTRE IMMOBILIER"
    );
  });
});

describe("isTruncatedPortalDescription", () => {
  it("detects ellipsis suffixes", () => {
    expect(
      isTruncatedPortalDescription(
        "Maison à vendre LEMAISTRE IMMOBILIER vous propose..."
      )
    ).toBe(true);
    expect(
      isTruncatedPortalDescription("Description complète sans coupure")
    ).toBe(false);
  });

  it("detects corrupted JSON fragments", () => {
    expect(
      isTruncatedPortalDescription(
        'Achat Maison 6 pièces 169 m² 299000 € Les Loges (76790)","canonical":"https://example.com'
      )
    ).toBe(true);
  });
});
