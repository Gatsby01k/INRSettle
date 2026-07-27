// Quote rate resolution (pure, env-driven — NO external FX feed).
//
// The platform has no live FX integration. The executable quote rate comes
// from ONE explicit source: the QUOTE_RATE_USDT_INR environment variable — a
// manually maintained treasury desk rate. A hardcoded fallback exists ONLY for
// local development; production always fails closed when the rate is absent
// rather than pricing real quotes with fictional numbers.

export type QuoteRateSource = "env" | "development_fallback";

export type QuoteRates = {
  /** INR per USDT applied to the INR -> USDT corridor. */
  INR_USDT: number;
  /** INR per USDT applied to the USDT -> INR corridor. */
  USDT_INR: number;
  source: QuoteRateSource;
  /** Product-facing label persisted into the quote audit entry. */
  label: string;
};

/** Local development fallback only — never available in production. */
export const DEVELOPMENT_FALLBACK_RATES = { INR_USDT: 83.5, USDT_INR: 83.15 } as const;

export type QuoteRateEnv = {
  QUOTE_RATE_USDT_INR?: string;
  NODE_ENV?: string;
};

/**
 * Resolves the quote rates for both corridors.
 *
 * Rules (fail closed):
 *  - QUOTE_RATE_USDT_INR set and a positive finite number -> used for BOTH
 *    corridors (single manual desk rate; no synthetic spread), source "env".
 *  - QUOTE_RATE_USDT_INR set but invalid -> throws, in every environment.
 *    A misconfigured rate must never silently price a quote.
 *  - Unset -> development fallback outside production. Production throws.
 */
export function resolveQuoteRates(env: QuoteRateEnv = process.env): QuoteRates {
  const raw = env.QUOTE_RATE_USDT_INR?.trim();

  if (raw !== undefined && raw !== "") {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(
        `QUOTE_RATE_USDT_INR is set but invalid ("${raw}"). It must be a positive number (INR per USDT). Quotes are blocked until it is fixed.`,
      );
    }
    return {
      INR_USDT: value,
      USDT_INR: value,
      source: "env",
      label: "Manual desk rate (QUOTE_RATE_USDT_INR) — no live FX feed",
    };
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "QUOTE_RATE_USDT_INR is not set. A manual desk rate is required to generate quotes in production.",
    );
  }

  return {
    INR_USDT: DEVELOPMENT_FALLBACK_RATES.INR_USDT,
    USDT_INR: DEVELOPMENT_FALLBACK_RATES.USDT_INR,
    source: "development_fallback",
    label: "Local development rate — unavailable in production",
  };
}
