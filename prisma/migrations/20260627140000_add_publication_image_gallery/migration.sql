-- Add multi-image gallery fields on listing publications.
-- Backfill image_urls from the legacy single image_url column.
-- image_gallery_enriched_at stays NULL so existing rows are re-enriched for full galleries.

ALTER TABLE "listing_publications" ADD COLUMN "image_urls" JSONB;
ALTER TABLE "listing_publications" ADD COLUMN "image_local_hashes" JSONB;
ALTER TABLE "listing_publications" ADD COLUMN "image_gallery_enriched_at" DATETIME;

UPDATE "listing_publications"
SET "image_urls" = json_array("image_url")
WHERE "image_url" IS NOT NULL;
