CREATE TABLE "user_notification_preferences" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL
);
