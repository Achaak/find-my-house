import { describe, expect, it } from "vitest";
import {
  applySeLogerSearchMetadata,
  parseSeLogerDetailEnergy,
  parseSeLogerSearchHtml,
  type SeLogerClassifiedCard,
} from "./selogerApi.js";

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

describe("parseSeLogerSearchHtml", () => {
  it("parses listings from embedded initialData JSON", () => {
    const payload =
      '{\\"cards\\":{\\"list\\":[{\\"cardType\\":\\"classified\\",\\"id\\":\\"abc123\\",\\"title\\":\\"Maison\\"}]},\\"navigation\\":{\\"counts\\":{\\"count\\":1},\\"pagination\\":{\\"resultsPerPage\\":35}}}';
    const html = `<script>window["initialData"]=JSON.parse("${payload}");</script>`;

    const result = parseSeLogerSearchHtml(html);

    expect(result.totalCount).toBe(1);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.id).toBe("abc123");
  });
});
