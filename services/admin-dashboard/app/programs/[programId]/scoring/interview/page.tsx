"use client";

import { use, useState } from "react";
import { InterviewParticipantsHeader } from "@/app/components/scoring/InterviewParticipantsHeader";
import { InterviewParticipantsTable } from "@/app/components/scoring/InterviewParticipantsTable";

export default function InterviewScoringPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (value: string) => {
    setSearchValue(value);
    console.info("Search interview participants:", value, "for program", programId);
  };

  const handleExport = () => {
    console.info("Export interview participants data for program", programId);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Interview Participants</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage interview participants and scoring for this program
        </p>
      </div>

      <div className="space-y-4">
        <InterviewParticipantsHeader onSearch={handleSearch} />
        <InterviewParticipantsTable onExport={handleExport} />
      </div>
    </div>
  );
}
