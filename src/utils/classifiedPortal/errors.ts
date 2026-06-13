import type { ClassifiedPortalConfig } from "./types.js";

export class ClassifiedPortalAccessBlockedError extends Error {
  readonly portalId: ClassifiedPortalConfig["id"];

  constructor(portal: ClassifiedPortalConfig, statusCode = 403) {
    super(
      `${portal.label} blocks automated requests (HTTP ${String(statusCode)}). ` +
        `Remove ${portal.id} from SCRAPE_SCRAPERS to skip this source.`
    );
    this.name = "ClassifiedPortalAccessBlockedError";
    this.portalId = portal.id;
  }
}
