import "dotenv/config";
import { defineConfig } from "prisma/config";

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const path = process.env.DATABASE_PATH ?? "./data/listings.db";
  return `file:${path}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
