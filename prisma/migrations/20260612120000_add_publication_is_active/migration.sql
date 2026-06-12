-- AlterTable
ALTER TABLE "listing_publications" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "listing_publications_source_is_active_idx" ON "listing_publications"("source", "is_active");
