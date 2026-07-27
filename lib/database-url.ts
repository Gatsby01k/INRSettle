const STRICT_SSL_ALIASES = new Set(["prefer", "require", "verify-ca"]);

/**
 * pg 8 treats prefer/require/verify-ca as verify-full, but that compatibility
 * behavior changes in pg 9. Make the current strict certificate and hostname
 * verification explicit so production security does not silently weaken after
 * a dependency upgrade.
 */
export function normalizeDatabaseConnectionString(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return connectionString;
  }

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const libpqCompatibility = url.searchParams.get("uselibpqcompat")?.toLowerCase() === "true";
  if (sslMode && STRICT_SSL_ALIASES.has(sslMode) && !libpqCompatibility) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }

  return connectionString;
}
