-- AlterTable
ALTER TABLE "properties" ADD COLUMN "first_price" INTEGER;

UPDATE "properties" SET "first_price" = "price" WHERE "first_price" IS NULL;
