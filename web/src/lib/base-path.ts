/** Home Assistant Ingress serves add-ons under /api/hassio_ingress/{token}/ */
const INGRESS_PATH_RE = /^(\/api\/hassio_ingress\/[^/]+)/;

declare global {
  interface Window {
    __INGRESS_PATH__?: string;
  }
}

export function getIngressBasePath(): string {
  if (typeof window === "undefined") return "";

  const injected = window.__INGRESS_PATH__?.replace(/\/$/, "");
  if (injected) return injected;

  const baseHref = document.querySelector("base")?.getAttribute("href");
  if (baseHref) {
    try {
      const pathname = new URL(baseHref, window.location.origin).pathname;
      if (INGRESS_PATH_RE.test(pathname)) {
        return pathname.replace(/\/$/, "");
      }
    } catch {
      // ignore invalid base href
    }
  }

  return window.location.pathname.match(INGRESS_PATH_RE)?.[1] ?? "";
}

export function withBasePath(path: string): string {
  const base = getIngressBasePath();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
