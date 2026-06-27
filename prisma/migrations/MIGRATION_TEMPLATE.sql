-- Template for SQLite table rebuilds. Copy when a migration renames/recreates parent tables.
-- Never DROP a parent table while child rows still reference it without disabling FK checks.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. Create new tables / copy data (child tables BEFORE dropping parents, or rebuild children after)
-- 2. DROP old tables only after children point at the new parent

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
