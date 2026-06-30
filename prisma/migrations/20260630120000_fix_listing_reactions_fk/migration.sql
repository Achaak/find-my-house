-- Rebuild listing_reactions: FK still pointed at properties_old after properties table rebuild.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

ALTER TABLE "listing_reactions" RENAME TO "listing_reactions_old";

CREATE TABLE "listing_reactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_reactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "listing_reactions" ("id", "property_id", "type", "archived_at", "created_at")
SELECT "id", "property_id", "type", "archived_at", "created_at"
FROM "listing_reactions_old";

DROP TABLE "listing_reactions_old";

CREATE UNIQUE INDEX "listing_reactions_property_id_key" ON "listing_reactions"("property_id");
CREATE INDEX "listing_reactions_type_idx" ON "listing_reactions"("type");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
