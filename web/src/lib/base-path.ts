/** Home Assistant Ingress serves add-ons under /api/hassio_ingress/{token}/ */
const INGRESS_PATH_RE = /^(\/api\/hassio_ingress\/[^/]+)/;

export function getIngressBasePath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.match(INGRESS_PATH_RE)?.[1] ?? "";
}

export function withBasePath(path: string): string {
  const base = getIngressBasePath();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
