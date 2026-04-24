"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProfileHeader, type ProfileHeaderData } from "@/app/components/participants/ProfileHeader";
import { ParticipantProfileTabs } from "@/app/components/participants/ParticipantProfileTabs";
import { GenerateLoaButton } from "@/app/components/participants/GenerateLoaButton";
import type { PersonalDetails } from "@/app/components/participants/tabs/PersonalDetailsTab";
import type { ProfessionalProfile } from "@/app/components/participants/tabs/ProfessionalProfileTab";
import type { EntryInformation } from "@/app/components/participants/tabs/EntryInformationTab";
import type { Miscellaneous } from "@/app/components/participants/tabs/MiscellaneousTab";
import { listApplications, getApplication, type Application } from "@/src/shared/api-client";

interface ParticipantData extends ProfileHeaderData {
  id: string;
  personal: PersonalDetails;
  professional: ProfessionalProfile;
  entry: EntryInformation;
  misc: Miscellaneous;
}

function mapToParticipantData(app: Application): ParticipantData {
  const p = app.participant;

  const phone = [p?.phoneCountryCode, p?.phoneNumber].filter(Boolean).join(" ") || "—";
  const location = [p?.originCity, p?.originCountry].filter(Boolean).join(", ") || "—";

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
      birthDate: p?.birthdate ? new Date(p.birthdate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—",
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
  const { programId, accountId } = params;

  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) setParticipant(mapToParticipantData(full));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load participant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [programId, accountId]);

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
          <Link href={`/programs/${programId}/dashboard`} className="hover:text-zinc-800 transition-colors">Dashboard</Link>
          <span>&gt;</span>
          <span className="font-semibold text-blue-600">Detail Participant</span>
        </div>
        {participant && <GenerateLoaButton programId={programId} participantId={accountId} />}
      </div>

      <div className="w-full min-h-[600px] rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-zinc-400">Loading participant…</div>
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
