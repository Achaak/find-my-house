-- Drop duplicated display fields from properties; track display enrichment on publications.
-- Disable FK checks while rebuilding tables so CASCADE does not wipe child rows.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

ALTER TABLE "properties" RENAME TO "properties_old";

CREATE TABLE "properties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "first_price" INTEGER NOT NULL,
    "has_price_drop" BOOLEAN NOT NULL DEFAULT false,
    "surface" REAL,
    "land_surface" REAL,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "is_new_property" BOOLEAN,
    "latitude" REAL,
    "longitude" REAL,
    "city" TEXT NOT NULL,
    "postal_code" TEXT,
    "address" TEXT,
    "dpe_numero" TEXT,
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
    "address_enriched_at" DATETIME,
    "first_seen_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

INSERT INTO "properties" (
    "id", "property_key", "title", "price", "first_price", "has_price_drop",
    "surface", "land_surface", "rooms", "bedrooms", "is_new_property",
    "latitude", "longitude", "city", "postal_code", "address", "dpe_numero",
    "property_type", "dpe_class", "ges_class", "dpe_consumption_kwh_m2",
    "ges_emission_kg_m2", "bathrooms", "construction_year", "heating",
    "orientation", "property_condition", "parking_spaces", "highlights",
    "address_enriched_at", "first_seen_at", "created_at", "updated_at"
)
SELECT
    "id", "property_key", "title", "price", "first_price", "has_price_drop",
    "surface", "land_surface", "rooms", "bedrooms", "is_new_property",
    "latitude", "longitude", "city", "postal_code", "address", "dpe_numero",
    "property_type", "dpe_class", "ges_class", "dpe_consumption_kwh_m2",
    "ges_emission_kg_m2", "bathrooms", "construction_year", "heating",
    "orientation", "property_condition", "parking_spaces", "highlights",
    "address_enriched_at", "first_seen_at", "created_at", "updated_at"
FROM "properties_old";

DROP TABLE "properties_old";

CREATE UNIQUE INDEX "properties_property_key_key" ON "properties"("property_key");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "properties_price_idx" ON "properties"("price");
CREATE INDEX "properties_first_seen_at_idx" ON "properties"("first_seen_at");

ALTER TABLE "listing_publications" RENAME TO "listing_publications_old";

CREATE TABLE "listing_publications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "surface" REAL,
    "land_surface" REAL,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "is_new_property" BOOLEAN,
    "latitude" REAL,
    "longitude" REAL,
    "city" TEXT NOT NULL,
    "postal_code" TEXT,
    "address" TEXT,
    "dpe_numero" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "image_urls" JSONB,
    "image_local_hashes" JSONB,
    "enriched_at" DATETIME,
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
    "address_enriched_at" DATETIME,
    "agency_slug" TEXT,
    "agency_ref" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "scraped_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "listing_publications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "listing_publications" (
    "id", "property_id", "external_id", "source", "url", "title", "price",
    "surface", "land_surface", "rooms", "bedrooms", "is_new_property",
    "latitude", "longitude", "city", "postal_code", "address", "dpe_numero",
    "description", "image_url", "image_urls", "image_local_hashes", "enriched_at",
    "property_type", "dpe_class", "ges_class", "dpe_consumption_kwh_m2",
    "ges_emission_kg_m2", "bathrooms", "construction_year", "heating",
    "orientation", "property_condition", "parking_spaces", "highlights",
    "address_enriched_at", "agency_slug", "agency_ref", "is_active",
    "scraped_at", "created_at", "updated_at"
)
SELECT
    "id", "property_id", "external_id", "source", "url", "title", "price",
    "surface", "land_surface", "rooms", "bedrooms", "is_new_property",
    "latitude", "longitude", "city", "postal_code", "address", "dpe_numero",
    "description", "image_url", "image_urls", "image_local_hashes",
    COALESCE("image_gallery_enriched_at", "display_enriched_at"),
    "property_type", "dpe_class", "ges_class", "dpe_consumption_kwh_m2",
    "ges_emission_kg_m2", "bathrooms", "construction_year", "heating",
    "orientation", "property_condition", "parking_spaces", "highlights",
    "address_enriched_at", "agency_slug", "agency_ref", "is_active",
    "scraped_at", "created_at", "updated_at"
FROM "listing_publications_old";

DROP TABLE "listing_publications_old";

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
