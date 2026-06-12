-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_listing_publications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "agency_slug" TEXT,
    "agency_ref" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "scraped_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "listing_publications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_listing_publications" ("id", "property_id", "external_id", "source", "url", "agency_slug", "agency_ref", "is_active", "scraped_at", "created_at", "updated_at") SELECT "id", "property_id", "external_id", "source", "url", "agency_slug", "agency_ref", "is_active", "scraped_at", "created_at", "updated_at" FROM "listing_publications";
DROP TABLE "listing_publications";
ALTER TABLE "new_listing_publications" RENAME TO "listing_publications";
CREATE UNIQUE INDEX "listing_publications_url_key" ON "listing_publications"("url");
CREATE INDEX "listing_publications_property_id_idx" ON "listing_publications"("property_id");
CREATE INDEX "listing_publications_source_is_active_idx" ON "listing_publications"("source", "is_active");
CREATE INDEX "listing_publications_agency_slug_agency_ref_idx" ON "listing_publications"("agency_slug", "agency_ref");
CREATE UNIQUE INDEX "listing_publications_source_external_id_key" ON "listing_publications"("source", "external_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
