"use client";

import React, { useState } from "react";
import { PersonalDetailsTab, PersonalDetails } from "./tabs/PersonalDetailsTab";
import { ProfessionalProfileTab, ProfessionalProfile } from "./tabs/ProfessionalProfileTab";
import { EntryInformationTab, EntryInformation } from "./tabs/EntryInformationTab";
import { MiscellaneousTab, Miscellaneous } from "./tabs/MiscellaneousTab";
import { EssaysTab, Essay } from "./tabs/EssaysTab";

const TABS = [
  { id: "personal", label: "Personal Details" },
  { id: "professional", label: "Professional Profile" },
  { id: "entry", label: "Entry Information" },
  { id: "misc", label: "Miscellaneous" },
  { id: "essays", label: "Essays" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface ParticipantTabsData {
  personal: PersonalDetails;
  professional: ProfessionalProfile;
  entry: EntryInformation;
  misc: Miscellaneous;
  essays: Essay[];
}

interface ParticipantProfileTabsProps {
  data: ParticipantTabsData;
}

export function ParticipantProfileTabs({ data }: ParticipantProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-4 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-2 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "personal" && <PersonalDetailsTab data={data.personal} />}
        {activeTab === "professional" && <ProfessionalProfileTab data={data.professional} />}
        {activeTab === "entry" && <EntryInformationTab data={data.entry} />}
        {activeTab === "misc" && <MiscellaneousTab data={data.misc} />}
        {activeTab === "essays" && <EssaysTab data={{ essays: data.essays }} />}
      </div>
    </div>
  );
}
