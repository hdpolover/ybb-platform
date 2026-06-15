"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldCheck, Pencil } from "lucide-react";
import { ProfileHeader, type ProfileHeaderData } from "@/app/components/participants/ProfileHeader";
import { ParticipantProfileTabs } from "@/app/components/participants/ParticipantProfileTabs";
import { GenerateLoaButton } from "@/app/components/participants/GenerateLoaButton";
import { EditSubmissionDrawer } from "@/app/components/participants/EditSubmissionDrawer";
import type { PersonalDetails } from "@/app/components/participants/tabs/PersonalDetailsTab";
import type { ProfessionalProfile } from "@/app/components/participants/tabs/ProfessionalProfileTab";
import type { EntryInformation } from "@/app/components/participants/tabs/EntryInformationTab";
import type { Miscellaneous } from "@/app/components/participants/tabs/MiscellaneousTab";
import { listApplications, getApplication, createSupportImpersonation, type Application } from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/src/ui/button";
import { Input } from "@/src/ui/input";
import { Label } from "@/src/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/ui/dialog";

interface ParticipantData extends ProfileHeaderData {
  id: string;
  personal: PersonalDetails;
  professional: ProfessionalProfile;
  entry: EntryInformation;
  misc: Miscellaneous;
}

const regionNames = typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

// Render a stored country value: convert a 2-letter ISO code (e.g. "ID") to a readable name; pass names through.
function formatCountry(raw: string | null | undefined): string {
  if (!raw) return "";
  if (regionNames && /^[A-Z]{2}$/.test(raw)) {
    try {
      return regionNames.of(raw) ?? raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

function mapToParticipantData(app: Application): ParticipantData {
  const p = app.participant;

  const phone = [p?.phoneCountryCode, p?.phoneNumber].filter(Boolean).join(" ") || "—";
  const location = [p?.originCity, formatCountry(p?.originCountry)].filter(Boolean).join(", ") || "—";

  const experiences: { role: string; company: string }[] = (() => {
    try {
      if (!app.experiences) return [];
      const parsed = JSON.parse(app.experiences);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return app.experiences
        ? app.experiences.split("\n").filter(Boolean).map((l) => ({ role: l, company: "" }))
        : [];
    }
  })();

  const achievementsList: string[] = (() => {
    try {
      if (!app.achievements) return [];
      const parsed = JSON.parse(app.achievements);
      if (Array.isArray(parsed)) return parsed;
      return [app.achievements];
    } catch {
      return app.achievements ? app.achievements.split("\n").filter(Boolean) : [];
    }
  })();

  return {
    id: app.id,
    accountId: app.participantId,
    name: p?.fullName ?? "—",
    avatarUrl: p?.profilePictureUrl ?? "",
    email: p?.email ?? "—",
    phone,
    location,
    personal: {
      fullName: p?.fullName ?? "—",
      nickname: p?.nickName ?? "—",
      gender: p?.gender ?? "—",
      birthDate: p?.birthdate ? formatDate(p.birthdate, { day: "numeric", month: "long", year: "numeric" }) : "—",
      nationality: p?.nationality ?? "—",
      originAddress: p?.originAddress ?? "—",
      currentAddress: p?.currentAddress ?? "—",
      phone,
      emergencyPhone: [p?.emergencyContactCountryCode, p?.emergencyContactPhone].filter(Boolean).join(" ") || "—",
      contactRelation: p?.emergencyContactRelation ?? "—",
      shirtSize: p?.tshirtSize ?? "—",
      diseaseHistory: p?.medicalConditions ?? "—",
    },
    professional: {
      educationLevel: p?.educationLevel ?? "—",
      institution: p?.institution ?? "—",
      major: p?.major ?? "—",
      organization: p?.organizations ?? "—",
      experience: experiences,
      achievements: achievementsList,
      cvFileName: p?.resumeUrl ? p.resumeUrl.split("/").pop() ?? p.resumeUrl : "—",
    },
    entry: {
      category: app.applicationCategory ?? "—",
      subtheme: "—",
      source: p?.knowledgeSource ?? "—",
      essayTitle: "—",
      essayContent: app.motivationLetter ?? "—",
      keywords: [],
      reference: "—",
    },
    misc: {
      instagram: p?.instagramUsername ? `https://instagram.com/${p.instagramUsername.replace(/^@/, "")}` : "—",
      knowledgeSource: p?.knowledgeSource ?? "—",
      sourceAccount: "—",
      twibbon: app.twibbonLink ?? "—",
      requirementLink: "—",
      referralCode: p?.referralCode ?? "—",
    },
  };
}

export default function ParticipantDetailPage() {
  const params = useParams<{ programId: string; accountId: string }>();
  const { programId: programIdParam, accountId } = params;
  const { accessiblePrograms, accessConfig } = useAuth();

  const programId = useMemo(() => {
    const p = accessiblePrograms.find(
      (p) => p.programId === programIdParam || p.programSlug === programIdParam,
    );
    return p?.programId ?? programIdParam;
  }, [accessiblePrograms, programIdParam]);

  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [rawApplication, setRawApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonationOpen, setImpersonationOpen] = useState(false);
  const [editSubmissionOpen, setEditSubmissionOpen] = useState(false);
  const [supportSecret, setSupportSecret] = useState("");
  const [reason, setReason] = useState("");
  const [startingImpersonation, setStartingImpersonation] = useState(false);

  useEffect(() => {
    if (!programId || !accountId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await listApplications({ programId, participantId: accountId, limit: 1 });
        const apps = list.data;
        if (!apps.length) throw new Error("No application found for this participant in this program.");
        const full = await getApplication(apps[0].id);
        if (!cancelled) {
          setParticipant(mapToParticipantData(full));
          setRawApplication(full);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load participant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [programId, accountId]);

  async function handleEditSaved() {
    // Reload participant data after a successful submission edit.
    if (!programId || !accountId) return;
    try {
      const list = await listApplications({ programId, participantId: accountId, limit: 1 });
      const apps = list.data;
      if (!apps.length) return;
      const full = await getApplication(apps[0].id);
      setParticipant(mapToParticipantData(full));
      setRawApplication(full);
      toast.success("Submission updated successfully.");
    } catch {
      toast.error("Failed to reload participant data.");
    }
  }

  async function handleStartImpersonation() {
    if (!participant) return;
    if (!supportSecret.trim()) {
      toast.error("Support secret is required.");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters.");
      return;
    }

    setStartingImpersonation(true);
    try {
      const result = await createSupportImpersonation({
        participantId: accountId,
        participantEmail: participant.email,
        programId,
        supportSecret: supportSecret.trim(),
        reason: reason.trim(),
      });
      window.open(result.loginUrl, "_blank", "noopener,noreferrer");
      setImpersonationOpen(false);
      setSupportSecret("");
      setReason("");
      toast.success("Participant impersonation session created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create impersonation session.");
    } finally {
      setStartingImpersonation(false);
    }
  }

  return (
    <div className="mx-auto w-full space-y-6">
      {rawApplication && (
        <EditSubmissionDrawer
          open={editSubmissionOpen}
          onClose={() => setEditSubmissionOpen(false)}
          application={rawApplication}
          onSaved={() => void handleEditSaved()}
        />
      )}

      <Dialog open={impersonationOpen} onOpenChange={setImpersonationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Login as Participant</DialogTitle>
            <DialogDescription>
              This creates a short-lived impersonation link. Every attempt is audited with your reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="support-secret">Support secret</Label>
              <Input
                id="support-secret"
                type="password"
                value={supportSecret}
                onChange={(e) => setSupportSecret(e.target.value)}
                autoComplete="off"
                placeholder="Enter support secret"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="impersonation-reason">Reason</Label>
              <textarea
                id="impersonation-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[96px] w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Describe why you need temporary access"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonationOpen(false)} disabled={startingImpersonation}>
              Cancel
            </Button>
            <Button onClick={() => void handleStartImpersonation()} loading={startingImpersonation}>
              Create Access Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
          <Link href={`/programs/${programId}/dashboard`} className="hover:text-zinc-800 transition-colors">Dashboard</Link>
          <span>&gt;</span>
          <span className="font-semibold text-blue-600">Detail Participant</span>
        </div>
        <div className="flex items-center gap-2.5">
          {participant && <GenerateLoaButton programId={programId} participantId={accountId} />}
          {accessConfig.canAccessPrograms && rawApplication ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditSubmissionOpen(true)}
              className="inline-flex items-center gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit Submission
            </Button>
          ) : null}
          {accessConfig.isSuperAdmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImpersonationOpen(true)}
              className="inline-flex items-center gap-2"
              disabled={!participant}
            >
              <ShieldCheck className="h-4 w-4" />
              Login as Participant
            </Button>
          ) : null}
        </div>
      </div>

      <div className="w-full min-h-[600px]">
        {loading && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-center py-24 text-sm text-zinc-400">Loading participant…</div>
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {participant && (
          <>
            <ProfileHeader data={participant} />
            <ParticipantProfileTabs data={participant} />
          </>
        )}
      </div>
    </div>
  );
}
