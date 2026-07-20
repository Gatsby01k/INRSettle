import "server-only";

import { UserFacingError } from "@/lib/errors";
import { isRemitQuicklyConfigured } from "@/lib/providers/remitquickly/client";
import {
  checkPayoutStatus as checkRemitQuicklyStatus,
  executeApprovedSettlement as executeRemitQuicklySettlement,
  PROVIDER as REMITQUICKLY_NAME,
} from "@/lib/providers/remitquickly/settlement";
import { isPontisConfigured } from "@/lib/providers/pontis/client";
import { isPontisGatewayConfigured } from "@/lib/providers/pontis/gateway";
import {
  checkPayoutStatus as checkPontisStatus,
  executeApprovedSettlement as executePontisSettlement,
  PROVIDER as PONTIS_NAME,
} from "@/lib/providers/pontis/settlement";
import type { ProviderConnector } from "@/lib/providers/contracts";

const connectors: ProviderConnector[] = [
  {
    code: "pontis",
    displayName: "PontisGlobe",
    persistedName: PONTIS_NAME,
    capabilities: ["india_settlement", "execute", "status_poll", "signed_webhook", "reconciliation_reference"],
    isConfigured: () => isPontisGatewayConfigured() || isPontisConfigured(),
    execute: ({ settlementId, userId, organizationId }) =>
      executePontisSettlement(settlementId, userId, organizationId),
    checkStatus: ({ settlementId, userId, organizationId }) =>
      checkPontisStatus(settlementId, userId, organizationId),
  },
  {
    code: "remitquickly",
    displayName: "RemitQuickly",
    persistedName: REMITQUICKLY_NAME,
    capabilities: ["india_settlement", "execute", "status_poll", "signed_webhook", "reconciliation_reference"],
    isConfigured: isRemitQuicklyConfigured,
    execute: ({ settlementId, userId, organizationId }) =>
      executeRemitQuicklySettlement(settlementId, userId, organizationId),
    checkStatus: ({ settlementId, userId, organizationId }) =>
      checkRemitQuicklyStatus(settlementId, userId, organizationId),
  },
];

export function providerCatalog() {
  return connectors.map((connector) => ({
    code: connector.code,
    displayName: connector.displayName,
    persistedName: connector.persistedName,
    capabilities: [...connector.capabilities],
    configured: connector.isConfigured(),
    supportsStatusPoll: Boolean(connector.checkStatus),
  }));
}

export function configuredProviderCatalog() {
  return providerCatalog().filter((provider) => provider.configured);
}

export function providerConnector(code: string): ProviderConnector {
  const connector = connectors.find((candidate) => candidate.code === code);
  if (!connector) throw new UserFacingError(`Unknown provider connector: ${code}.`);
  if (!connector.isConfigured()) {
    throw new UserFacingError(`${connector.displayName} is not configured in this environment.`);
  }
  return connector;
}

export function providerConnectorForPersistedName(name: string): ProviderConnector {
  const connector = connectors.find(
    (candidate) => candidate.persistedName.toLowerCase() === name.toLowerCase(),
  );
  if (!connector) throw new UserFacingError(`No connector is registered for provider ${name}.`);
  if (!connector.isConfigured()) {
    throw new UserFacingError(`${connector.displayName} is not configured in this environment.`);
  }
  return connector;
}
