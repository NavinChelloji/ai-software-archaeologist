#!/usr/bin/env node
// Cross-platform dbmate runner. Each deployable owns its database and its
// migrations folder (RULES.md #10); this script just resolves the right
// DATABASE_URL for each one and shells out to the dbmate binary, so
// `pnpm db:migrate` works the same on Windows, macOS, and Linux without
// relying on shell-specific $VAR expansion in package.json scripts.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(rootDir, ".env") });

const SERVICES = {
  api: { envVar: "API_DATABASE_URL", dir: "services/ai-archaeologist-auth/migrations" },
  indexer: { envVar: "INDEXER_DATABASE_URL", dir: "services/ai-archaeologist-repository/migrations" },
  ai: { envVar: "AI_DATABASE_URL", dir: "services/ai-archaeologist-intelligence/migrations" },
};

function runDbmate(service, args) {
  const config = SERVICES[service];
  if (!config) {
    console.error(`Unknown service "${service}". Expected one of: ${Object.keys(SERVICES).join(", ")}`);
    process.exit(1);
  }

  const databaseUrl = process.env[config.envVar];
  if (!databaseUrl) {
    console.error(`${config.envVar} is not set. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }

  const migrationsDir = path.join(rootDir, config.dir);
  if (!existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  console.log(`\n> dbmate ${args.join(" ")} (${service})`);
  const result = spawnSync(
    "dbmate",
    ["--url", databaseUrl, "--migrations-dir", migrationsDir, ...args],
    { stdio: "inherit", shell: true, cwd: rootDir }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const [, , command, target, ...rest] = process.argv;

if (command === "up") {
  const services = target === "all" || !target ? Object.keys(SERVICES) : [target];
  for (const service of services) {
    runDbmate(service, ["up"]);
  }
} else if (command === "new") {
  const [name] = rest;
  if (!target || !name) {
    console.error("Usage: node scripts/db-migrate.mjs new <api|indexer|ai> <migration_name>");
    process.exit(1);
  }
  runDbmate(target, ["new", name]);
} else {
  console.error("Usage: node scripts/db-migrate.mjs up <api|indexer|ai|all>");
  console.error("       node scripts/db-migrate.mjs new <api|indexer|ai> <migration_name>");
  process.exit(1);
}
