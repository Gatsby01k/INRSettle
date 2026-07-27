import { describe, expect, it } from "vitest";
import { DEVELOPMENT_FALLBACK_RATES, resolveQuoteRates } from "../quote-rate";

describe("environment quote rate", () => {
  it("uses one valid desk rate for both corridors", () => {
    const rates = resolveQuoteRates({ QUOTE_RATE_USDT_INR: "84.25", NODE_ENV: "production" });
    expect(rates.USDT_INR).toBe(84.25);
    expect(rates.INR_USDT).toBe(84.25);
    expect(rates.source).toBe("env");
    expect(rates.label).toMatch(/Manual desk rate/);
    expect(rates.label).toMatch(/no live FX feed/i);
  });

  it("trims whitespace and accepts integers", () => {
    const rates = resolveQuoteRates({ QUOTE_RATE_USDT_INR: " 83 ", NODE_ENV: "development" });
    expect(rates.USDT_INR).toBe(83);
    expect(rates.source).toBe("env");
  });
});

describe("fail-closed quote pricing", () => {
  it.each(["abc", "-5", "0", "NaN", "Infinity"])("rejects invalid value '%s'", (raw) => {
    expect(() => resolveQuoteRates({ QUOTE_RATE_USDT_INR: raw, NODE_ENV: "production" })).toThrow(
      /invalid/,
    );
  });

  it("rejects an invalid value in development", () => {
    expect(() => resolveQuoteRates({ QUOTE_RATE_USDT_INR: "oops", NODE_ENV: "development" })).toThrow(
      /invalid/,
    );
  });

  it("never uses a fallback in production", () => {
    expect(() => resolveQuoteRates({ NODE_ENV: "production" })).toThrow(/QUOTE_RATE_USDT_INR is not set/);
  });

  it("uses a clearly labelled fallback only in local development", () => {
    const rates = resolveQuoteRates({ NODE_ENV: "development" });
    expect(rates.source).toBe("development_fallback");
    expect(rates.INR_USDT).toBe(DEVELOPMENT_FALLBACK_RATES.INR_USDT);
    expect(rates.USDT_INR).toBe(DEVELOPMENT_FALLBACK_RATES.USDT_INR);
    expect(rates.label).toMatch(/Local development rate/);
  });

  it("treats an empty environment value as unset", () => {
    const rates = resolveQuoteRates({ QUOTE_RATE_USDT_INR: "", NODE_ENV: "development" });
    expect(rates.source).toBe("development_fallback");
  });
});
