-- CreateTable
CREATE TABLE "properties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_key" TEXT NOT NULL,
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
    "description" TEXT,
    "image_url" TEXT,
    "property_type" TEXT,
    "first_seen_at" DATETIME NOT NULL,
    "notified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "listing_publications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "property_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "scraped_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "listing_publications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate listings -> properties (1:1, clé temporaire)
INSERT INTO "properties" (
    "id",
    "property_key",
    "title",
    "price",
    "surface",
    "land_surface",
    "rooms",
    "bedrooms",
    "is_new_property",
    "latitude",
    "longitude",
    "city",
    "postal_code",
    "description",
    "image_url",
    "property_type",
    "first_seen_at",
    "notified_at",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    'legacy:' || "id",
    "title",
    "price",
    "surface",
    "land_surface",
    "rooms",
    "bedrooms",
    "is_new_property",
    "latitude",
    "longitude",
    "city",
    "postal_code",
    "description",
    "image_url",
    "property_type",
    "scraped_at",
    "scraped_at",
    "created_at",
    "updated_at"
FROM "listings";

-- Migrate listings -> listing_publications
INSERT INTO "listing_publications" (
    "property_id",
    "external_id",
    "source",
    "url",
    "scraped_at",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "external_id",
    "source",
    "url",
    "scraped_at",
    "created_at",
    "updated_at"
FROM "listings";

-- Recreate reactions with property_id
CREATE TABLE "listing_reactions_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discord_user_id" TEXT NOT NULL,
    "property_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_reactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "listing_reactions_new" ("id", "discord_user_id", "property_id", "type", "created_at")
SELECT "id", "discord_user_id", "listing_id", "type", "created_at"
FROM "listing_reactions";

DROP TABLE "listing_reactions";
ALTER TABLE "listing_reactions_new" RENAME TO "listing_reactions";

DROP TABLE "listings";

-- CreateIndex
CREATE UNIQUE INDEX "properties_property_key_key" ON "properties"("property_key");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_price_idx" ON "properties"("price");

-- CreateIndex
CREATE INDEX "properties_first_seen_at_idx" ON "properties"("first_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "listing_publications_url_key" ON "listing_publications"("url");

-- CreateIndex
CREATE INDEX "listing_publications_property_id_idx" ON "listing_publications"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_publications_source_external_id_key" ON "listing_publications"("source", "external_id");

-- CreateIndex
CREATE INDEX "listing_reactions_discord_user_id_type_idx" ON "listing_reactions"("discord_user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "listing_reactions_discord_user_id_property_id_key" ON "listing_reactions"("discord_user_id", "property_id");
