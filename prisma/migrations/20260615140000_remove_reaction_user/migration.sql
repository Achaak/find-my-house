PRAGMA foreign_keys=OFF;

CREATE TABLE "listing_reactions_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_reactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "listing_reactions_new" ("property_id", "type", "archived_at", "created_at")
SELECT
    "property_id",
    "type",
    "archived_at",
    "created_at"
FROM "listing_reactions"
WHERE "id" IN (
    SELECT "id"
    FROM "listing_reactions" AS "r"
    WHERE "r"."created_at" = (
        SELECT MAX("r2"."created_at")
        FROM "listing_reactions" AS "r2"
        WHERE "r2"."property_id" = "r"."property_id"
    )
);

DROP TABLE "listing_reactions";

ALTER TABLE "listing_reactions_new" RENAME TO "listing_reactions";

CREATE UNIQUE INDEX "listing_reactions_property_id_key" ON "listing_reactions"("property_id");
CREATE INDEX "listing_reactions_type_idx" ON "listing_reactions"("type");

PRAGMA foreign_keys=ON;
