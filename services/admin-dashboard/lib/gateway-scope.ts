// services/admin-dashboard/lib/gateway-scope.ts
/**
 * Pure helpers for payment-gateway config scope (global / brand / program).
 */

export type GatewayScope = "platform" | "brand" | "program";

type ScopedConfig = { id: string; brand_id?: string | null; program_id?: string | null };

export function scopeOf(cfg: Pick<ScopedConfig, "brand_id" | "program_id">): GatewayScope {
  if (cfg.program_id) return "program";
  if (cfg.brand_id) return "brand";
  return "platform";
}

// Names are looked up by id; an id missing from the map renders as "unknown"
// rather than leaking a raw UUID into the label.
export function scopeLabel(
  cfg: Pick<ScopedConfig, "brand_id" | "program_id">,
  brandNameById: Record<string, string>,
  programNameById: Record<string, string>,
): string {
  if (cfg.program_id) return `Program: ${programNameById[cfg.program_id] ?? "unknown program"}`;
  if (cfg.brand_id) return `Brand: ${brandNameById[cfg.brand_id] ?? "unknown brand"}`;
  return "Global";
}

const API_VERSION_SUFFIX = /\/v1\/?$/;

// Scoped configs get a per-config URL so the Go service can pick the right
// credentials; the legacy global URL carries no id.
export function webhookUrl(
  provider: string,
  configId: string | null | undefined,
  apiBase: string,
): string {
  const root = apiBase.replace(API_VERSION_SUFFIX, "").replace(/\/+$/, "");
  const base = `${root}/v1/webhooks/payment/${provider}`;
  return configId ? `${base}/${configId}` : base;
}

// Global configs keep the legacy URL; any scoped config uses its own id.
export function webhookUrlForConfig(cfg: ScopedConfig & { provider: string }, apiBase: string): string {
  return webhookUrl(cfg.provider, scopeOf(cfg) === "platform" ? null : cfg.id, apiBase);
}
