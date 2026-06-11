import { BASE_URL } from "./types.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CLIENT_HINT_HEADERS = {
  "Sec-CH-UA":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"macOS"',
} as const;

export function getSeLogerHeaders(
  kind: "html" | "json",
  extra: Record<string, string> = {}
): Record<string, string> {
  const base =
    kind === "html"
      ? {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent": USER_AGENT,
          ...CLIENT_HINT_HEADERS,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        }
      : {
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
          Origin: BASE_URL,
          Referer: `${BASE_URL}/classified-search`,
          "User-Agent": USER_AGENT,
          ...CLIENT_HINT_HEADERS,
        };

  return { ...base, ...extra };
}
