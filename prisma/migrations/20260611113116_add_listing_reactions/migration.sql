-- CreateTable
CREATE TABLE "listing_reactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discord_user_id" TEXT NOT NULL,
    "listing_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_reactions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "listing_reactions_discord_user_id_type_idx" ON "listing_reactions"("discord_user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "listing_reactions_discord_user_id_listing_id_key" ON "listing_reactions"("discord_user_id", "listing_id");
