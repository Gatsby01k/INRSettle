export function providerConnectionStatusLabel(status: string) {
  switch (status) {
    case "DISABLED":
      return "Disabled";
    case "CONFIGURING":
      return "Configuration in progress";
    case "INTEGRATION_VERIFIED":
      return "Integration verified";
    case "COMMERCIAL_READY":
      return "Commercially ready";
    case "SUSPENDED":
      return "Suspended";
    default:
      return status.toLowerCase().replaceAll("_", " ");
  }
}

export function providerConnectionStatusTone(status: string) {
  if (status === "COMMERCIAL_READY") return "success" as const;
  if (status === "INTEGRATION_VERIFIED") return "info" as const;
  if (status === "CONFIGURING") return "warning" as const;
  if (status === "SUSPENDED") return "danger" as const;
  return "neutral" as const;
}
