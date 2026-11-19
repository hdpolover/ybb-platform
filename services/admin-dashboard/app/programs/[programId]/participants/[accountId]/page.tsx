"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { ShieldCheck, Pencil } from "lucide-react";
import { ProfileHeader, type ProfileHeaderData } from "@/app/components/participants/ProfileHeader";
import { ParticipantProfileTabs, type ParticipantRemoteTabsContext } from "@/app/components/participants/ParticipantProfileTabs";
import { editHistoryQueryKey } from "@/app/components/participants/tabs/EditHistoryTab";
import { EditSubmissionDrawer } from "@/app/components/participants/EditSubmissionDrawer";
import { useProgramWriteAccess } from "@/app/hooks/useProgramWriteAccess";
import { programWritePermissions } from "@/lib/admin-access";
import type { PersonalDetails } from "@/app/components/participants/tabs/PersonalDetailsTab";
import type { ProfessionalProfile } from "@/app/components/participants/tabs/ProfessionalProfileTab";
import type { EntryInformation } from "@/app/components/participants/tabs/EntryInformationTab";
import type { Miscellaneous } from "@/app/components/participants/tabs/MiscellaneousTab";
import type { Essay } from "@/app/components/participants/tabs/EssaysTab";
import type { SubmittedForm } from "@/app/components/participants/tabs/SubmittedFormTab";
import { ParticipantNavBar } from "@/app/components/participants/ParticipantNavBar";
import { listApplications, getApplication, createSupportImpersonation, type Application } from "@/src/shared/api-client";
import { findFormField, getExtraFieldsByTab, getFieldDisplayValue, getSubmittedSections } from "@/lib/form-extra-fields";
import { formatCountry, formatFieldValue } from "@/lib/field-value-format";
import { STATUS_LABEL, humanizeStatus } from "@/lib/application-badges";
import type { ProfileSummaryFields } from "@/lib/profile-summary";
import { buildChangeFields, buildChangeLabels } from "@/lib/edit-history";
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
  essays: Essay[];
  submitted: SubmittedForm;
}

const clean = (v: string | null | undefined): string => v?.trim() || "—";

function mapToParticipantData(app: Application): ParticipantData {
  const p = app.participant;

  const sections = app.submissionForm?.sections;
  const extras = getExtraFieldsByTab(sections);
  // Fixed row: the participant column formatted like the program form's field of that name (option label, country, date).
  const fixed = (raw: string | null | undefined, ...names: string[]): string =>
    formatFieldValue(raw, findFormField(sections, ...names) ?? { name: names[0] }) || "—";
  // phoneNumber / emergencyContactPhone already carry the country code.
  const phone = clean(p?.phoneNumber);
  // Raw option value ("instagram") -> the form's option label when the form defines one.
  const knowledgeSource =
    getFieldDisplayValue(sections, "knowledge_source") ??
    getFieldDisplayValue(sections, "referral_source") ??
    fixed(p?.knowledgeSource, "knowledge_source", "referral_source");
  const location = [p?.originCity, formatCountry(p?.originCountry)].filter(Boolean).join(", ") || "—";

  const experiences: { role: string; company: string }[] = (() => {
    try {
      if (!app.experiences) return [];
      const parsed = JSON.parse(app.experiences);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return app.experiences
        ? app.experiences.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ role: l, company: "" }))
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
      return app.achievements ? app.achievements.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    }
  })();

  return {
    id: app.id,
    accountId: app.participantId,
    name: p?.fullName ?? "—",
    avatarUrl: p?.profilePictureUrl ?? "",
    email: p?.email ?? "—",
    phone,
    phoneValid: p?.phoneValid,
    location,
    status: app.status,
    applicationCategory: app.applicationCategory,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    registrationPaymentStatus: app.registrationPaymentStatus,
    programPaymentStatus: app.programPaymentStatus,
    fundingDecision: app.fundingDecision,
    personal: {
      fullName: clean(p?.fullName),
      nickname: clean(p?.nickName),
      gender: fixed(p?.gender, "gender"),
      birthDate: fixed(p?.birthdate, "birthdate", "date_of_birth"),
      nationality: fixed(p?.nationality, "nationality"),
      originAddress: clean(p?.originAddress),
      currentAddress: clean(p?.currentAddress),
      phone,
      phoneValid: p?.phoneValid,
      emergencyContactName: clean(p?.emergencyContactName),
      emergencyPhone: clean(p?.emergencyContactPhone),
      emergencyPhoneValid: p?.emergencyContactPhoneValid,
      contactRelation: fixed(p?.emergencyContactRelation, "emergency_contact_relation", "contact_relation"),
      shirtSize: fixed(p?.tshirtSize, "tshirt_size"),
      diseaseHistory: clean(p?.medicalConditions),
      extraFields: extras.personal,
    },
    professional: {
      educationLevel: fixed(p?.educationLevel, "education_level"),
      institution: clean(p?.institution),
      major: clean(p?.major),
      occupation: clean(p?.occupation),
      organization: clean(p?.organizations),
      experience: experiences,
      achievements: achievementsList,
      resume: p?.resumeUrl?.trim() ?? "",
      extraFields: extras.professional,
    },
    entry: {
      category: formatFieldValue(app.applicationCategory, { name: "category" }) || "—",
      subtheme: app.subthemeName ?? app.subthemeId ?? "—",
      source: knowledgeSource,
      reference: clean(app.referralCode),
      extraFields: extras.entry,
    },
    misc: {
      instagram: p?.instagramUsername?.trim() ?? "",
      knowledgeSource,
      sourceAccount: clean(app.sourceAccountName),
      twibbon: clean(app.twibbonLink),
      requirementLink: clean(app.requirementLink),
      referralCode: clean(p?.referralCode),
      extraFields: extras.misc,
    },
    essays: app.essays ?? [],
    submitted: { sections: getSubmittedSections(sections) },
  };
}

export default function ParticipantDetailPage() {
  const params = useParams<{ programId: string; accountId: string }>();
  const { programId: programIdParam, accountId } = params;
  // participants:write (Digital Marketing) is not enough: the API wants applications:write.
  const canEditSubmission = useProgramWriteAccess(programIdParam, programWritePermissions.applicationEdit);
  const { accessiblePrograms, accessConfig } = useAuth();
  const queryClient = useQueryClient();

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

  const summary = useMemo<ProfileSummaryFields | null>(() => {
    if (!participant) return null;
    const program =
      rawApplication?.program?.name ?? accessiblePrograms.find((p) => p.programId === programId)?.programName ?? "";
    return {
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      program,
      category: participant.entry.category,
      applicationStatus: STATUS_LABEL[participant.status] ?? humanizeStatus(participant.status),
      registrationFee: humanizeStatus(participant.registrationPaymentStatus),
      programFee: humanizeStatus(participant.programPaymentStatus),
      nationality: participant.personal.nationality,
      institution: participant.professional.institution,
      major: participant.professional.major,
    };
  }, [participant, rawApplication, accessiblePrograms, programId]);

  const remoteTabs = useMemo<ParticipantRemoteTabsContext | null>(() => {
    if (!rawApplication) return null;
    return {
      programId,
      applicationId: rawApplication.id,
      changeLabels: buildChangeLabels(rawApplication.submissionForm?.sections, rawApplication.essays),
      changeFields: buildChangeFields(rawApplication.submissionForm?.sections),
      participantEmail: rawApplication.participant?.email ?? undefined,
    };
  }, [rawApplication, programId]);

  useEffect(() => {
    if (!programId || !accountId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      // Prev/next lands here with a new accountId: drop the old profile instead of showing it under the spinner.
      setParticipant(null);
      setRawApplication(null);
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

  const currentAccountId = useRef(accountId);
  useEffect(() => { currentAccountId.current = accountId; }, [accountId]);

  async function handleEditSaved() {
    // Reload participant data after a successful submission edit.
    if (!programId || !accountId) return;
    const savedFor = accountId;
    try {
      const list = await listApplications({ programId, participantId: accountId, limit: 1 });
      const apps = list.data;
      if (!apps.length) return;
      const full = await getApplication(apps[0].id);
      // Prev/next keeps this page mounted; drop the reload if the admin moved on meanwhile.
      if (currentAccountId.current !== savedFor) return;
      setParticipant(mapToParticipantData(full));
      setRawApplication(full);
      // Refetches the Edit History tab if it is open; if it was loaded earlier, marks it stale for the next open.
      void queryClient.invalidateQueries({ queryKey: editHistoryQueryKey(full.id) });
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <Link href={`/programs/${programId}/dashboard`} className="hover:text-zinc-800 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="font-semibold text-blue-600">Detail Participant</span>
          </div>
          <ParticipantNavBar programParam={programIdParam} accountId={accountId} />
        </div>
        <div className="flex items-center gap-2.5">
          {accessConfig.canAccessPrograms && canEditSubmission && rawApplication ? (
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
        {participant && summary && remoteTabs && (
          <>
            <ProfileHeader data={participant} summary={summary} />
            <ParticipantProfileTabs data={participant} remote={remoteTabs} />
          </>
        )}
      </div>
    </div>
  );
}
