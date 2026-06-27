import { withBasePath } from "./base-path";

const LOCAL_MEDIA_PREFIX = "/api/media/";

/** Prefix locally stored media paths for Home Assistant Ingress. */
export function resolveMediaUrl(url: string): string {
  if (url.startsWith(LOCAL_MEDIA_PREFIX)) {
    return withBasePath(url);
  }
  return url;
}
