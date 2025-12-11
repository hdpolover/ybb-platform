"use client";

import { use } from "react";
import { ProgramSpeakersHeader } from "@/app/components/programSpeakersMasterData/ProgramSpeakersHeader";
import { ProgramSpeakersList } from "@/app/components/programSpeakersMasterData/ProgramSpeakersList";

export default function ProgramSpeakersPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);

  return (
    <div className="space-y-4">
      <ProgramSpeakersHeader />
      <section className="rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700 shadow-sm md:text-base">
        <ProgramSpeakersList />
      </section>
    </div>
  );
}

// TODO: implement Program Speakers master data page
