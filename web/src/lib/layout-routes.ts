export function isImmersiveRoute(pathname: string): boolean {
  return /^\/listings\/[^/]+$/.test(pathname);
}

export { navItemActive } from "./nav-items.js";

export const IMMERSIVE_PREFIXES = ["/listings/"];
