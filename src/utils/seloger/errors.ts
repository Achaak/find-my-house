export class SeLogerAccessBlockedError extends Error {
  constructor(statusCode = 403) {
    super(
      `SeLoger bloque les requêtes automatisées (HTTP ${String(statusCode)}). ` +
        "Retirez seloger de SCRAPE_SCRAPERS pour ignorer cette source."
    );
    this.name = "SeLogerAccessBlockedError";
  }
}
