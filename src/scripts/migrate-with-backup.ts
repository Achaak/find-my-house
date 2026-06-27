import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import "dotenv/config";

function resolveDatabasePath(): string {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("file:")) {
    const raw = url.slice("file:".length);
    return raw.startsWith("/") ? raw : path.resolve(process.cwd(), raw);
  }
  const configured = process.env.DATABASE_PATH ?? "./data/listings.db";
  return path.resolve(process.cwd(), configured);
}

function backupDatabase(dbPath: string): string | null {
  if (!existsSync(dbPath)) return null;

  const backupDir = path.join(path.dirname(dbPath), "backups");
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `${path.basename(dbPath)}.${stamp}.bak`
  );
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

const prismaArgs = process.argv.slice(2);
const subcommand =
  prismaArgs[0] === "deploy"
    ? ["migrate", "deploy"]
    : ["migrate", "dev", ...prismaArgs];

const dbPath = resolveDatabasePath();
const backupPath = backupDatabase(dbPath);
if (backupPath) {
  console.log(`[db] Backup: ${backupPath}`);
} else {
  console.log(`[db] No existing database at ${dbPath} — skipping backup`);
}

execSync(["pnpm", "exec", "prisma", ...subcommand].join(" "), {
  stdio: "inherit",
  cwd: process.cwd(),
});
