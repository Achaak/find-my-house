-- CreateTable
CREATE TABLE "stats_daily_snapshots" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "active_properties" INTEGER NOT NULL,
    "active_publications" INTEGER NOT NULL,
    "median_price" INTEGER NOT NULL,
    "price_drop_count" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
