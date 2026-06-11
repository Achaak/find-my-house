-- Drop unused notification timestamp (never read after write).
ALTER TABLE "properties" DROP COLUMN "notified_at";
