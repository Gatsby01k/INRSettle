import type { Prisma, SettlementStatus } from "@prisma/client";

export type ProviderCapability =
  | "prefunding"
  | "india_settlement"
  | "execute"
  | "status_poll"
  | "signed_webhook"
  | "reconciliation_reference";

export type ProviderExecutionContext = {
  settlementId: string;
  userId: string;
  organizationId: string;
  /**
   * Tenant-specific connection metadata. `credentialsRef` is an opaque secret
   * manager reference, never the credential value. Existing sandbox adapters
   * still use deployment-scoped environment credentials; a future connector
   * resolves this reference in its server-side adapter.
   */
  connection: {
    id: string;
    credentialsRef: string | null;
    configuration: Prisma.JsonValue | null;
  } | null;
};

export type ProviderExecutionResult = {
  operationId: string;
  providerCode: string;
  providerReference: string | null;
  providerStatus: string | null;
  settlementStatus: SettlementStatus;
  replayed: boolean;
};

/**
 * Universal lifecycle-level connector contract. Provider-specific request and
 * response schemas stay in each connector directory. The orchestrator only
 * sees normalized identity, capabilities and lifecycle operations.
 *
 * InvoiceMate/PayMate can implement this interface after its authoritative API
 * contract, webhook signing scheme and sandbox credentials are supplied; no
 * payload or status mapping is guessed in this repository.
 */
export type ProviderConnector = {
  code: string;
  displayName: string;
  persistedName: string;
  capabilities: readonly ProviderCapability[];
  isConfigured(): boolean;
  execute(context: ProviderExecutionContext): Promise<unknown>;
  checkStatus?(context: ProviderExecutionContext): Promise<unknown>;
};
