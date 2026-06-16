/*
  Warnings:

  - You are about to alter the column `highlights` on the `properties` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - Made the column `first_price` on table `properties` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_listing_publications" (
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
INSERT INTO "new_listing_publications" ("address", "address_enriched_at", "agency_ref", "agency_slug", "bathrooms", "bedrooms", "city", "construction_year", "created_at", "description", "display_enriched_at", "dpe_class", "dpe_consumption_kwh_m2", "dpe_numero", "external_id", "ges_class", "ges_emission_kg_m2", "heating", "highlights", "id", "image_url", "is_active", "is_new_property", "land_surface", "latitude", "longitude", "orientation", "parking_spaces", "postal_code", "price", "property_condition", "property_id", "property_type", "rooms", "scraped_at", "source", "surface", "title", "updated_at", "url") SELECT "address", "address_enriched_at", "agency_ref", "agency_slug", "bathrooms", "bedrooms", "city", "construction_year", "created_at", "description", "display_enriched_at", "dpe_class", "dpe_consumption_kwh_m2", "dpe_numero", "external_id", "ges_class", "ges_emission_kg_m2", "heating", "highlights", "id", "image_url", "is_active", "is_new_property", "land_surface", "latitude", "longitude", "orientation", "parking_spaces", "postal_code", "price", "property_condition", "property_id", "property_type", "rooms", "scraped_at", "source", "surface", "title", "updated_at", "url" FROM "listing_publications";
DROP TABLE "listing_publications";
ALTER TABLE "new_listing_publications" RENAME TO "listing_publications";
CREATE UNIQUE INDEX "listing_publications_url_key" ON "listing_publications"("url");
CREATE INDEX "listing_publications_property_id_idx" ON "listing_publications"("property_id");
CREATE INDEX "listing_publications_property_id_is_active_scraped_at_idx" ON "listing_publications"("property_id", "is_active", "scraped_at");
CREATE INDEX "listing_publications_source_is_active_idx" ON "listing_publications"("source", "is_active");
CREATE INDEX "listing_publications_is_active_city_postal_code_idx" ON "listing_publications"("is_active", "city", "postal_code");
CREATE INDEX "listing_publications_is_active_price_idx" ON "listing_publications"("is_active", "price");
CREATE INDEX "listing_publications_is_active_surface_idx" ON "listing_publications"("is_active", "surface");
CREATE INDEX "listing_publications_agency_slug_agency_ref_idx" ON "listing_publications"("agency_slug", "agency_ref");
CREATE UNIQUE INDEX "listing_publications_source_external_id_key" ON "listing_publications"("source", "external_id");
CREATE TABLE "new_properties" (
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
    "first_seen_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_properties" ("address", "address_enriched_at", "bathrooms", "bedrooms", "city", "construction_year", "created_at", "description", "display_enriched_at", "dpe_class", "dpe_consumption_kwh_m2", "dpe_numero", "first_price", "first_seen_at", "ges_class", "ges_emission_kg_m2", "has_price_drop", "heating", "highlights", "id", "image_url", "is_new_property", "land_surface", "latitude", "longitude", "orientation", "parking_spaces", "postal_code", "price", "property_condition", "property_key", "property_type", "rooms", "surface", "title", "updated_at") SELECT "address", "address_enriched_at", "bathrooms", "bedrooms", "city", "construction_year", "created_at", "description", "display_enriched_at", "dpe_class", "dpe_consumption_kwh_m2", "dpe_numero", "first_price", "first_seen_at", "ges_class", "ges_emission_kg_m2", "has_price_drop", "heating", "highlights", "id", "image_url", "is_new_property", "land_surface", "latitude", "longitude", "orientation", "parking_spaces", "postal_code", "price", "property_condition", "property_key", "property_type", "rooms", "surface", "title", "updated_at" FROM "properties";
DROP TABLE "properties";
ALTER TABLE "new_properties" RENAME TO "properties";
CREATE UNIQUE INDEX "properties_property_key_key" ON "properties"("property_key");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "properties_price_idx" ON "properties"("price");
CREATE INDEX "properties_first_seen_at_idx" ON "properties"("first_seen_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
