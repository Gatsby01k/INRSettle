import { defineConfig, env } from "prisma/config";
import { normalizeDatabaseConnectionString } from "./lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: normalizeDatabaseConnectionString(env("DATABASE_URL")),
  },
});
