"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { getProgramConfig, updateProgramConfig } from "@/src/shared/api-client";
import { MainConfigurationHeader } from "./mainConfiguration/MainConfigurationHeader";
import { MainConfigurationContent } from "./mainConfiguration/MainConfigurationContent";

export type MainConfigurationSettingsProps = {
  programId: string;
  programName: string;
};

export function MainConfigurationSettings({
  programId,
  programName,
}: MainConfigurationSettingsProps) {
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [emailVerification, setEmailVerification] = useState<"Optional" | "Required">("Required");
  const [programActive, setProgramActive] = useState(true);
  const [usdToIdrRate, setUsdToIdrRate] = useState(16900);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const programStatusLabel = programActive ? "Active" : "Inactive";
  const registrationStatusLabel = registrationOpen ? "Open" : "Closed";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getProgramConfig(programId);
      setRegistrationOpen(config.allowRegistration);
      setEmailVerification(config.requireEmailVerification ? "Required" : "Optional");
      setProgramActive(config.isActive);
      setUsdToIdrRate(config.usdInIdr ?? 16900);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProgramConfig(programId, {
        isActive: programActive,
        allowRegistration: registrationOpen,
        requireEmailVerification: emailVerification === "Required",
        usdInIdr: usdToIdrRate,
      });
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4 text-sm md:text-base">
      <MainConfigurationHeader
        programName={programName}
        programStatusLabel={programStatusLabel}
        registrationStatusLabel={registrationStatusLabel}
      />

      {loading ? (
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-center text-xs text-zinc-400 shadow-sm">
          Loading settings…
        </div>
      ) : (
        <MainConfigurationContent
          registrationOpen={registrationOpen}
          onToggleRegistration={() => setRegistrationOpen((p) => !p)}
          emailVerification={emailVerification}
          onToggleEmailVerification={() =>
            setEmailVerification((p) => (p === "Required" ? "Optional" : "Required"))
          }
          programActive={programActive}
          onToggleProgramActive={() => setProgramActive((p) => !p)}
          usdToIdrRate={usdToIdrRate}
          onChangeUsdToIdrRate={setUsdToIdrRate}
          saving={saving}
          onSave={handleSave}
          onCancel={load}
        />
      )}
    </main>
  );
}
