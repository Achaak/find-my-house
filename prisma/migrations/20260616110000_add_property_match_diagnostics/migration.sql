-- CreateTable
CREATE TABLE "property_match_diagnostics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listing_source" TEXT NOT NULL,
    "listing_external_id" TEXT NOT NULL,
    "postal_code" TEXT,
    "threshold" REAL NOT NULL,
    "best_score" REAL,
    "best_candidate_id" INTEGER,
    "best_veto" TEXT,
    "near_misses" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "property_match_diagnostics_created_at_idx" ON "property_match_diagnostics"("created_at");

-- CreateIndex
CREATE INDEX "property_match_diagnostics_listing_source_listing_external_id_idx" ON "property_match_diagnostics"("listing_source", "listing_external_id");
