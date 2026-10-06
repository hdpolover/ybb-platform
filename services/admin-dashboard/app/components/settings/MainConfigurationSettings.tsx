"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
import {
  getProgramConfig,
  updateProgramConfig,
} from "@/src/shared/api-client";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { EmptyState } from "@/src/admin/empty-state";
import { MainConfigurationHeader } from "./mainConfiguration/MainConfigurationHeader";
import { MainConfigurationContent } from "./mainConfiguration/MainConfigurationContent";

export type MainConfigurationSettingsProps = {
  programId: string;
  programName: string;
};

type ConfigValues = {
  registrationOpen: boolean;
  emailVerificationRequired: boolean;
  programActive: boolean;
};

export function MainConfigurationSettings({
  programId,
  programName,
}: MainConfigurationSettingsProps) {
  const resolvedProgramId = useResolvedProgramId(programId);
  // `saved` is what the server last confirmed; `draft` is what the switches show.
  // Nothing is assumed before the first load: a guessed default would render a
  // green switch for a program whose registration is actually off.
  const [saved, setSaved] = useState<ConfigValues | null>(null);
  const [draft, setDraft] = useState<ConfigValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getProgramConfig(resolvedProgramId);
      const values: ConfigValues = {
        registrationOpen: config.allowRegistration,
        emailVerificationRequired: config.requireEmailVerification,
        programActive: config.isActive,
      };
      setSaved(values);
      setDraft(values);
    } catch (err) {
      setSaved(null);
      setDraft(null);
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [resolvedProgramId]);

  useEffect(() => { load(); }, [load]);

  const isDirty =
    saved !== null &&
    draft !== null &&
    (saved.registrationOpen !== draft.registrationOpen ||
      saved.emailVerificationRequired !== draft.emailVerificationRequired ||
      saved.programActive !== draft.programActive);

  // The switches only change local state until Save Changes is clicked, so
  // leaving with a flipped-but-unsaved switch silently discards the change.
  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await updateProgramConfig(resolvedProgramId, {
        isActive: draft.programActive,
        allowRegistration: draft.registrationOpen,
        requireEmailVerification: draft.emailVerificationRequired,
      });
      setSaved(draft);
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const toggle = (field: keyof ConfigValues) =>
    setDraft((current) => (current ? { ...current, [field]: !current[field] } : current));

  return (
    <main className="space-y-4 text-sm md:text-base">
      <MainConfigurationHeader
        programName={programName}
        programStatusLabel={saved ? (saved.programActive ? "Active" : "Inactive") : "Unknown"}
        registrationStatusLabel={saved ? (saved.registrationOpen ? "Open" : "Closed") : "Unknown"}
      />

      {loading ? (
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-8 text-center text-xs text-zinc-400 shadow-sm">
          Loading settings…
        </div>
      ) : draft ? (
        <MainConfigurationContent
          registrationOpen={draft.registrationOpen}
          onToggleRegistration={() => toggle("registrationOpen")}
          emailVerification={draft.emailVerificationRequired ? "Required" : "Optional"}
          onToggleEmailVerification={() => toggle("emailVerificationRequired")}
          programActive={draft.programActive}
          onToggleProgramActive={() => toggle("programActive")}
          saving={saving}
          isDirty={isDirty}
          onSave={handleSave}
          onCancel={() => setDraft(saved)}
        />
      ) : (
        <div className="rounded-md border border-zinc-200 bg-white shadow-sm">
          <EmptyState
            icon={TriangleAlert}
            title="Settings could not be loaded"
            description="The current values are unknown, so nothing is shown rather than a guess."
            action={{ label: "Try again", onClick: load }}
            className="py-10"
          />
        </div>
      )}
    </main>
  );
}
