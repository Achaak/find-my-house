-- Search-cache indexes + drop display-only Property columns + publication addressEnrichedAt.
-- Display fields are computed from publications at read time; address enrichment is property-scoped.

CREATE INDEX "listing_publications_is_active_enriched_at_idx"
  ON "listing_publications"("is_active", "enriched_at");

CREATE INDEX "properties_has_price_drop_price_idx"
  ON "properties"("has_price_drop", "price");

ALTER TABLE "properties" DROP COLUMN "address";
ALTER TABLE "properties" DROP COLUMN "dpe_numero";
ALTER TABLE "properties" DROP COLUMN "property_type";
ALTER TABLE "properties" DROP COLUMN "dpe_consumption_kwh_m2";
ALTER TABLE "properties" DROP COLUMN "ges_emission_kg_m2";
ALTER TABLE "properties" DROP COLUMN "bathrooms";
ALTER TABLE "properties" DROP COLUMN "construction_year";
ALTER TABLE "properties" DROP COLUMN "heating";
ALTER TABLE "properties" DROP COLUMN "orientation";
ALTER TABLE "properties" DROP COLUMN "property_condition";
ALTER TABLE "properties" DROP COLUMN "parking_spaces";
ALTER TABLE "properties" DROP COLUMN "highlights";

ALTER TABLE "listing_publications" DROP COLUMN "address_enriched_at";
