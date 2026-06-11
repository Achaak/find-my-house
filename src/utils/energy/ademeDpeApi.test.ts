import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../http/client.js", () => ({
  ademeHttpClient: { get },
  HTTPError: class HTTPError extends Error {},
}));

import { fetchDpeByNumero } from "./ademeDpeApi.js";

describe("fetchDpeByNumero", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("returns the matching DPE from recent dataset results", async () => {
    get.mockImplementation((url: string) => ({
      json: () => {
        if (url.includes("meg-83tjwtg8dyz4vv7h1dqe")) {
          return Promise.resolve({
            results: [
              {
                numero_dpe: "1234567890123A",
                adresse_ban: "12 rue de Rivoli 75001 Paris",
                code_postal_ban: "75001",
                etiquette_dpe: "C",
              },
            ],
          });
        }
        return Promise.resolve({ results: [] });
      },
    }));

    const result = await fetchDpeByNumero("1234567890123A");

    expect(result).toMatchObject({
      numeroDpe: "1234567890123A",
      postalCode: "75001",
      dpeClass: "C",
      dataset: "recent",
    });
  });

  it("returns null for empty numero", async () => {
    await expect(fetchDpeByNumero("   ")).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
