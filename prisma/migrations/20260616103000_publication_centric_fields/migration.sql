-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_listing_publications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL DEFAULT 0,
    "surface" REAL,
    "land_surface" REAL,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "is_new_property" BOOLEAN,
    "latitude" REAL,
    "longitude" REAL,
    "city" TEXT NOT NULL DEFAULT '',
    "postal_code" TEXT,
    "address" TEXT,
    "dpe_numero" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "property_type" TEXT,
    "dpe_class" TEXT,
    "ges_class" TEXT,
    "dpe_consumption_kwh_m2" REAL,
    "ges_emission_kg_m2" REAL,
    "bathrooms" INTEGER,
    "construction_year" INTEGER,
    "heating" TEXT,
    "orientation" TEXT,
    "property_condition" TEXT,
    "parking_spaces" INTEGER,
    "highlights" JSONB,
    "display_enriched_at" DATETIME,
    "address_enriched_at" DATETIME,
    "agency_slug" TEXT,
    "agency_ref" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "scraped_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "listing_publications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_listing_publications" (
    "id","property_id","external_id","source","url","title","price","surface","land_surface","rooms","bedrooms","is_new_property","latitude","longitude","city","postal_code","address","dpe_numero","description","image_url","property_type","dpe_class","ges_class","dpe_consumption_kwh_m2","ges_emission_kg_m2","bathrooms","construction_year","heating","orientation","property_condition","parking_spaces","highlights","display_enriched_at","address_enriched_at","agency_slug","agency_ref","is_active","scraped_at","created_at","updated_at"
)
SELECT
    lp."id",lp."property_id",lp."external_id",lp."source",lp."url",
    COALESCE(p."title", ''),COALESCE(p."price", 0),p."surface",p."land_surface",p."rooms",p."bedrooms",p."is_new_property",
    p."latitude",p."longitude",COALESCE(p."city", ''),p."postal_code",p."address",p."dpe_numero",p."description",p."image_url",p."property_type",
    p."dpe_class",p."ges_class",p."dpe_consumption_kwh_m2",p."ges_emission_kg_m2",p."bathrooms",p."construction_year",p."heating",p."orientation",
    p."property_condition",p."parking_spaces",p."highlights",p."display_enriched_at",p."address_enriched_at",
    lp."agency_slug",lp."agency_ref",lp."is_active",lp."scraped_at",lp."created_at",lp."updated_at"
FROM "listing_publications" lp
JOIN "properties" p ON p."id" = lp."property_id";
DROP TABLE "listing_publications";
ALTER TABLE "new_listing_publications" RENAME TO "listing_publications";
CREATE UNIQUE INDEX "listing_publications_url_key" ON "listing_publications"("url");
CREATE UNIQUE INDEX "listing_publications_source_external_id_key" ON "listing_publications"("source", "external_id");
CREATE INDEX "listing_publications_property_id_idx" ON "listing_publications"("property_id");
CREATE INDEX "listing_publications_property_id_is_active_scraped_at_idx" ON "listing_publications"("property_id", "is_active", "scraped_at");
CREATE INDEX "listing_publications_source_is_active_idx" ON "listing_publications"("source", "is_active");
CREATE INDEX "listing_publications_is_active_city_postal_code_idx" ON "listing_publications"("is_active", "city", "postal_code");
CREATE INDEX "listing_publications_is_active_price_idx" ON "listing_publications"("is_active", "price");
CREATE INDEX "listing_publications_is_active_surface_idx" ON "listing_publications"("is_active", "surface");
CREATE INDEX "listing_publications_agency_slug_agency_ref_idx" ON "listing_publications"("agency_slug", "agency_ref");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
