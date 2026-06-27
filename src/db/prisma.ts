import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client.js";

let prisma: PrismaClient | undefined;
let runtimeConfigured = false;
let runtimeConfigPromise: Promise<void> | undefined;

const SQLITE_FILE_URL = /^file:(.+)$/;

function ensureDatabaseDir(databaseUrl: string): void {
  const match = SQLITE_FILE_URL.exec(databaseUrl);
  if (!match) return;

  const dbPath = match[1].startsWith("/")
    ? match[1]
    : path.resolve(process.cwd(), match[1]);
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function ensurePrismaRuntime(client: PrismaClient): Promise<void> {
  if (runtimeConfigured) return;
  runtimeConfigPromise ??= (async () => {
    await client.$executeRawUnsafe(`PRAGMA journal_mode = WAL`);
    await client.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
    runtimeConfigured = true;
  })();
  await runtimeConfigPromise;
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
    runtimeConfigured = false;
    runtimeConfigPromise = undefined;
  }
}
