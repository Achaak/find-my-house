import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client.js";

let prisma: PrismaClient | undefined;

function ensureDatabaseDir(databaseUrl: string): void {
  const match = databaseUrl.match(/^file:(.+)$/);
  if (!match) return;

  const dbPath = match[1].startsWith("/")
    ? match[1]
    : path.resolve(process.cwd(), match[1]);
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getPrisma(databaseUrl: string): PrismaClient {
  if (!prisma) {
    ensureDatabaseDir(databaseUrl);
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
