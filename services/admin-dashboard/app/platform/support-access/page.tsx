"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/src/admin/page-header";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import {
  getSupportAccessConfig,
  updateSupportAccessConfig,
  type SupportAccessConfig,
} from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";

const SECRET_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function SupportAccessPage() {
  const { accessConfig } = useAuth();
  const [config, setConfig] = useState<SupportAccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [newSecret, setNewSecret] = useState("");
  const [confirmSecret, setConfirmSecret] = useState("");

  const canManage = accessConfig.isSuperAdmin;

  const secretValidation = useMemo(() => {
    if (!newSecret) return null;
    if (!SECRET_COMPLEXITY_REGEX.test(newSecret)) {
      return "Secret must be at least 12 characters and include upper, lower, number, and symbol.";
    }
    if (confirmSecret && newSecret !== confirmSecret) {
      return "Secret confirmation does not match.";
    }
    return null;
  }, [newSecret, confirmSecret]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSupportAccessConfig();
      setConfig(data);
      setEnabled(data.isEnabled);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load support access config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    void loadConfig();
  }, [canManage, loadConfig]);

  async function handleSave() {
    if (!canManage) return;
    if (secretValidation) {
      toast.error(secretValidation);
      return;
    }
    if (newSecret && newSecret !== confirmSecret) {
      toast.error("Secret confirmation does not match.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSupportAccessConfig({
        isEnabled: enabled,
        ...(newSecret ? { newSecret } : {}),
      });
      setConfig(updated);
      setEnabled(updated.isEnabled);
      setNewSecret("");
      setConfirmSecret("");
      toast.success("Support access settings updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update support access settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Support Access"
          description="Only super admins can manage support impersonation controls."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You do not have permission to access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Access"
        description="Configure and audit one-time participant impersonation access for manual verification."
      />

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Impersonation Guardrails</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Admins must provide the support secret and a reason for every participant impersonation attempt.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading settings...</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2.5">
              <span className="text-sm font-medium text-zinc-800">Enable support access impersonation</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="support-secret">Rotate support secret</Label>
                <Input
                  id="support-secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave empty to keep current secret"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-secret-confirm">Confirm support secret</Label>
                <Input
                  id="support-secret-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat new secret"
                  value={confirmSecret}
                  onChange={(e) => setConfirmSecret(e.target.value)}
                />
              </div>
            </div>

            {secretValidation ? (
              <p className="text-xs text-red-600">{secretValidation}</p>
            ) : (
              <p className="text-xs text-zinc-500">
                Secret policy: minimum 12 chars, includes uppercase, lowercase, number, and symbol.
              </p>
            )}

            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              <p>Configured: {config?.hasSecret ? "Yes" : "No"}</p>
              <p>Status: {enabled ? "Enabled" : "Disabled"}</p>
              {config?.participantPortalOrigin ? (
                <p>Participant portal: {config.participantPortalOrigin}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end">
              <Button onClick={() => void handleSave()} loading={saving}>
                Save Support Access
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

