ALTER TABLE "listing_publications" ADD COLUMN "agency_slug" TEXT;
ALTER TABLE "listing_publications" ADD COLUMN "agency_ref" TEXT;

CREATE INDEX "listing_publications_agency_slug_agency_ref_idx"
ON "listing_publications"("agency_slug", "agency_ref");
