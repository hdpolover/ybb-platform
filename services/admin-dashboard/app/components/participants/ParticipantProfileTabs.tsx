"use client";

import React, { useState } from "react";
import { PersonalDetailsTab, PersonalDetails } from "./tabs/PersonalDetailsTab";
import { ProfessionalProfileTab, ProfessionalProfile } from "./tabs/ProfessionalProfileTab";
import { EntryInformationTab, EntryInformation } from "./tabs/EntryInformationTab";
import { MiscellaneousTab, Miscellaneous } from "./tabs/MiscellaneousTab";

const TABS = [
  { id: "personal", label: "Personal Details" },
  { id: "professional", label: "Professional Profile" },
  { id: "entry", label: "Entry Information" },
  { id: "misc", label: "Miscellaneous" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface ParticipantTabsData {
  personal: PersonalDetails;
  professional: ProfessionalProfile;
  entry: EntryInformation;
  misc: Miscellaneous;
}

interface ParticipantProfileTabsProps {
  data: ParticipantTabsData;
}

export function ParticipantProfileTabs({ data }: ParticipantProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");

  return (
    <div className="mt-8">
      {/* Navigasi Tab */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
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

      {/* Konten Tab Aktif */}
      <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "personal" && <PersonalDetailsTab data={data.personal} />}
        {activeTab === "professional" && <ProfessionalProfileTab data={data.professional} />}
        {activeTab === "entry" && <EntryInformationTab data={data.entry} />}
        {activeTab === "misc" && <MiscellaneousTab data={data.misc} />}
      </div>
    </div>
  );
}