"use client";

import React from "react";
import { FullyFundedParticipantsFilters } from "./FullyFundedParticipantsFilters";
import { FullyFundedParticipantsTable, FullyFundedParticipantRow } from "./FullyFundedParticipantsTable";

const mockFullyFundedParticipants: FullyFundedParticipantRow[] = [
  { id: 1, accountId: "167920692d5fa1becc2", name: "SAMYIA AZIZAHMED MAKRANI", email: "samyiaazizahmed79@gmail.com", participantId: "#17061B", nationality: "India", formStatus: "Submitted", registeredOn: "Dec 01, 2025" },
  { id: 2, accountId: "167920692d5fa1bedd1", name: "Alya Putri Nirmala", email: "alya.putri@example.com", participantId: "#17022A", nationality: "Indonesia", formStatus: "On Progress", registeredOn: "Nov 28, 2025" },
  { id: 3, accountId: "167920692d5fa1bef31", name: "Kenji Sato", email: "kenji.sato@example.jp", participantId: "#17045J", nationality: "Japan", formStatus: "Not Started", registeredOn: "Nov 25, 2025" },
  { id: 4, accountId: "167920692d5fa1beaa9", name: "Nurul Huda", email: "nurul.huda@example.my", participantId: "#17030M", nationality: "Malaysia", formStatus: "Submitted", registeredOn: "Nov 20, 2025" },
  { id: 5, accountId: "167920692d5fa1becc3", name: "Ashwini Vaibhav Pol", email: "ash.jawale16@gmail.com", participantId: "#17070I", nationality: "India", formStatus: "Not Started", registeredOn: "Dec 01, 2025" },
  { id: 6, accountId: "167920692d5fa1becc4", name: "Aya Gamal", email: "ayagamal453@gmail.com", participantId: "#17012E", nationality: "Egypt", formStatus: "On Progress", registeredOn: "Nov 30, 2025" },
];

export function FullyFundedParticipantsAll() {
  const rows = mockFullyFundedParticipants;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <FullyFundedParticipantsFilters />
      <div className="my-5 border-t border-zinc-100" />
      <FullyFundedParticipantsTable data={rows} />
    </section>
  );
}