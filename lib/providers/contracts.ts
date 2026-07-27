import type { Prisma, SettlementStatus } from "@prisma/client";

export type ProviderCapability =
  | "prefunding"
  | "india_settlement"
  | "execute"
  | "status_poll"
  | "signed_webhook"
  | "reconciliation_reference";

export type ProviderAuthentication =
  | "api_key_hmac"
  | "jwt"
  | "oauth2"
  | "mtls"
  | "provider_gateway";

export type ProviderCredentialStrategy =
  | "deployment_secret"
  | "tenant_secret_reference";

export type ProviderWebhookVerification =
  | "hmac_raw_body"
  | "gateway_verified"
  | "provider_signature";

export type ProviderExecutionContext = {
  settlementId: string;
  userId: string;
  organizationId: string;
  /**
   * Tenant-specific connection metadata. `credentialsRef` is an opaque secret
   * manager reference, never the credential value. Connector metadata declares
   * whether the active adapter uses this tenant reference or a deployment-level
   * secret binding.
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
 * A new provider implements this interface only after its authoritative API
 * contract, authentication scheme and webhook verification rules are known.
 * Provider payloads and statuses are never guessed in the orchestrator.
 */
export type ProviderConnector = {
  code: string;
  displayName: string;
  persistedName: string;
  supportedCorridors: readonly ("INR_USDT" | "USDT_INR")[];
  capabilities: readonly ProviderCapability[];
  authentication: readonly ProviderAuthentication[];
  credentialStrategy: ProviderCredentialStrategy;
  webhookVerification: ProviderWebhookVerification | null;
  isConfigured(): boolean;
  execute(context: ProviderExecutionContext): Promise<unknown>;
  checkStatus?(context: ProviderExecutionContext): Promise<unknown>;
};
