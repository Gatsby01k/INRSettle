import { defineConfig, env } from "prisma/config";
import { normalizeDatabaseConnectionString } from "./lib/database-url";

// Prisma migrations use a direct connection when the deployment provides one.
// Session-level advisory locks can otherwise remain attached to pooled
// connections after a build process exits.
const migrationDatabaseUrl = process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: normalizeDatabaseConnectionString(migrationDatabaseUrl),
  },
});
