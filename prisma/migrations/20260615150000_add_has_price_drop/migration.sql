-- AlterTable
ALTER TABLE "properties" ADD COLUMN "has_price_drop" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing rows
UPDATE "properties" SET "has_price_drop" = 1 WHERE "price" < "first_price";
