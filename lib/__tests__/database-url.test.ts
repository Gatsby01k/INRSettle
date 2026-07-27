import { describe, expect, it } from "vitest";
import { normalizeDatabaseConnectionString } from "@/lib/database-url";

describe("normalizeDatabaseConnectionString", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "makes the pg 8 strict behavior explicit for sslmode=%s",
    (sslMode) => {
      const normalized = normalizeDatabaseConnectionString(
        `postgresql://user:password@db.example.com/app?sslmode=${sslMode}&channel_binding=require`,
      );
      const url = new URL(normalized);

      expect(url.searchParams.get("sslmode")).toBe("verify-full");
      expect(url.searchParams.get("channel_binding")).toBe("require");
    },
  );

  it("leaves verify-full unchanged", () => {
    const connectionString =
      "postgresql://user:password@db.example.com/app?sslmode=verify-full";

    expect(normalizeDatabaseConnectionString(connectionString)).toBe(connectionString);
  });

  it("respects an explicit libpq compatibility request", () => {
    const connectionString =
      "postgresql://user:password@db.example.com/app?uselibpqcompat=true&sslmode=require";

    expect(normalizeDatabaseConnectionString(connectionString)).toBe(connectionString);
  });

  it.each([
    "postgresql://user:password@localhost:5432/app",
    "mysql://user:password@db.example.com/app?sslmode=require",
    "not-a-url",
  ])("does not rewrite unrelated connection strings: %s", (connectionString) => {
    expect(normalizeDatabaseConnectionString(connectionString)).toBe(connectionString);
  });
});
