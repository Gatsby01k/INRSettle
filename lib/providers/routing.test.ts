import { describe, expect, it } from "vitest";
import { deriveProviderCircuit, evaluateProviderRoutes } from "@/lib/providers/routing";

const NOW = new Date("2026-07-27T12:00:00.000Z");

describe("deriveProviderCircuit", () => {
  it("opens after consecutive failed or uncertain operations", () => {
    expect(
      deriveProviderCircuit(
        [
          { status: "REVIEW_REQUIRED", createdAt: new Date("2026-07-27T11:59:00.000Z") },
          { status: "FAILED", createdAt: new Date("2026-07-27T11:58:00.000Z") },
          { status: "FAILED", createdAt: new Date("2026-07-27T11:57:00.000Z") },
        ],
        NOW,
      ),
    ).toBe("OPEN");
  });

  it("moves to half open after cooldown and closes after success", () => {
    const failures = [
      { status: "FAILED", createdAt: new Date("2026-07-27T11:30:00.000Z") },
      { status: "FAILED", createdAt: new Date("2026-07-27T11:29:00.000Z") },
      { status: "REVIEW_REQUIRED", createdAt: new Date("2026-07-27T11:28:00.000Z") },
    ];
    expect(deriveProviderCircuit(failures, NOW)).toBe("HALF_OPEN");
    expect(
      deriveProviderCircuit(
        [{ status: "SUCCEEDED", createdAt: new Date("2026-07-27T11:59:30.000Z") }, ...failures],
        NOW,
      ),
    ).toBe("CLOSED");
  });
});

describe("evaluateProviderRoutes", () => {
  const candidates = [
    {
      code: "alpha",
      displayName: "Alpha",
      configured: true,
      capabilities: ["india_settlement", "execute", "signed_webhook"] as const,
    },
    {
      code: "beta",
      displayName: "Beta",
      configured: true,
      capabilities: ["india_settlement", "execute", "signed_webhook", "prefunding"] as const,
    },
  ];
  const connections = [
    { providerCode: "alpha", status: "COMMERCIAL_READY", credentialsRef: "vault://alpha" },
    { providerCode: "beta", status: "COMMERCIAL_READY", credentialsRef: "vault://beta" },
  ];

  it("selects only a provider with every required capability", () => {
    const result = evaluateProviderRoutes({
      candidates,
      connections,
      requiredCapabilities: ["india_settlement", "execute", "prefunding"],
      preferredOrder: ["alpha", "beta"],
    });
    expect(result.selected?.code).toBe("beta");
    expect(result.evaluations.find((item) => item.code === "alpha")?.eligible).toBe(false);
  });

  it("blocks all automatic fallback after an operation exists", () => {
    const result = evaluateProviderRoutes({
      candidates,
      connections,
      requiredCapabilities: ["execute"],
      operationStarted: true,
    });
    expect(result.selected).toBeNull();
    expect(result.fallbackPermitted).toBe(false);
  });
});
