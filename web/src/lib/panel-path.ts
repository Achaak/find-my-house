type HaPanelRoute = {
  path?: string;
  prefix?: string;
};

/** Normalize the route tail sent by the Home Assistant app panel iframe API. */
export function normalizeHaPanelPath(route: HaPanelRoute): string {
  const raw = route.path?.trim() ?? "";
  if (!raw) {
    return "/";
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;

  // HA's app panel applies computeRouteTail twice, turning /listings/42 into /42.
  const numericTail = path.match(/^\/(\d+)$/);
  if (numericTail) {
    return `/listings/${numericTail[1]}`;
  }

  return path;
}
