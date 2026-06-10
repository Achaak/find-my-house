-- CreateTable
CREATE TABLE "listings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "external_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "surface" REAL,
    "rooms" INTEGER,
    "city" TEXT NOT NULL,
    "postal_code" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "property_type" TEXT,
    "scraped_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_url_key" ON "listings"("url");

-- CreateIndex
CREATE INDEX "listings_city_idx" ON "listings"("city");

-- CreateIndex
CREATE INDEX "listings_price_idx" ON "listings"("price");

-- CreateIndex
CREATE INDEX "listings_scraped_at_idx" ON "listings"("scraped_at");

-- CreateIndex
CREATE UNIQUE INDEX "listings_source_external_id_key" ON "listings"("source", "external_id");
