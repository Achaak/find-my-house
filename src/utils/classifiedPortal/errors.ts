import type { ClassifiedPortalConfig } from "./types.js";

export class ClassifiedPortalAccessBlockedError extends Error {
  readonly portalId: ClassifiedPortalConfig["id"];

  constructor(portal: ClassifiedPortalConfig, statusCode = 403) {
    super(
      `${portal.label} bloque les requêtes automatisées (HTTP ${String(statusCode)}). ` +
        `Retirez ${portal.id} de SCRAPE_SCRAPERS pour ignorer cette source.`
    );
    this.name = "ClassifiedPortalAccessBlockedError";
    this.portalId = portal.id;
  }
}
