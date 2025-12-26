"use client";

import { use } from "react";
import { FullyFundedParticipantProfileCard } from "../../../../components/scoring/FullyFundedParticipantProfileCard";
import { FullyFundedContactInformationCard } from "../../../../components/scoring/FullyFundedContactInformationCard";
import { FullyFundedDetailsTabsCard } from "../../../../components/scoring/FullyFundedDetailsTabsCard";

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ programId: string; accountId: string }>;
}) {
  const { accountId } = use(params);
  // NOTE: Untuk sekarang masih pake data dummy dulu buat detail pesertanya.

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-900">Participant Detail</h1>
        <p className="text-sm text-zinc-600">
          Detailed profile and scoring information for the selected participant
        </p>
        <p className="text-xs text-zinc-400">Account ID: {accountId}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FullyFundedParticipantProfileCard
          name="SAMYIA AZIZAHMED MAKRANI"
          participantId="#17061B"
          fundingPath="Fully Funded"
        />

        <div className="md:col-span-2">
          <FullyFundedContactInformationCard
            fullName="SAMYIA AZIZAHMED MAKRANI"
            email="samyiaazizahmed79@gmail.com"
            phone="+91 98765 43210"
            nationality="India"
            gender="Female"
            institution="ABC International School"
            onEditProfile={() => {
              // TODO: Nanti dihubungin ke flow edit profile benerannya
              console.info("Edit profile clicked");
            }}
            onExportData={() => {
              // TODO: Nanti dihubungin ke flow export data aselinya
              console.info("Export data clicked");
            }}
          />
        </div>
      </section>

      <FullyFundedDetailsTabsCard hideScores />
    </div>
  );
}
