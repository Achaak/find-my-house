import type { Page, Response } from "playwright";

export function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function waitForJsonResponse<T>(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 30_000
): Promise<T> {
  const response = await page.waitForResponse(
    (res: Response) => {
      const matches =
        typeof urlPattern === "string"
          ? res.url().includes(urlPattern)
          : urlPattern.test(res.url());
      return matches && res.status() === 200 && res.request().method() === "GET";
    },
    { timeout }
  );

  return response.json() as Promise<T>;
}
