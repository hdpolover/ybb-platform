import { ProgramSpeakersHeader } from "@/app/components/programSpeakersMasterData/ProgramSpeakersHeader";
import { ProgramSpeakersTable, type ProgramSpeaker } from "@/app/components/programSpeakersMasterData/ProgramSpeakersTable";

// --- MOCK DATA (Simulasi Fetch dari DB/API) ---
const MOCK_SPEAKERS: ProgramSpeaker[] = [
  {
    id: 1,
    name: "Dr. Hana Nakamura",
    title: "Professor of International Relations",
    organization: "Tokyo Global University",
    email: "hana.nakamura@example.com",
    type: "Keynote",
    status: "Active",
    biography: "Dr. Hana has over 15 years of experience working on youth diplomacy, peacebuilding, and cross-cultural leadership programs across Asia and Europe.",
    expertiseAreas: "Youth Diplomacy, Peacebuilding, Global Governance",
    photoUrl: "/img/mock/speaker-hana.jpg",
    linkedInUrl: "https://www.linkedin.com/in/hananakamura",
    instagramUrl: "https://www.instagram.com/hanaspeaks",
    sessionTitle: "Youth as Catalysts for Global Change",
    sessionTime: "Day 1, 09:00 - 10:30",
    sessionDescription: "A keynote session exploring how young leaders can shape global narratives and drive impact through collaboration.",
  },
  {
    id: 2,
    name: "Michael Tan",
    title: "Social Innovation Strategist",
    organization: "ImpactBridge Asia",
    email: "michael.tan@example.com",
    type: "Regular",
    status: "Active",
    biography: "Michael works with youth-led organizations to design social innovation projects and sustainable community programs.",
    expertiseAreas: "Social Innovation, Design Thinking, Community Development",
    photoUrl: "/img/mock/speaker-michael.jpg",
    linkedInUrl: "https://www.linkedin.com/in/michaeltan",
    sessionTitle: "Design Thinking for Youth-Led Projects",
    sessionTime: "Day 1, 13:30 - 15:00",
    sessionDescription: "A hands-on workshop guiding participants to design impactful and feasible community initiatives.",
  },
  {
    id: 3,
    name: "Aisha Rahman",
    title: "Program Manager",
    organization: "Global Youth Network",
    email: "aisha.rahman@example.com",
    type: "Regular",
    status: "Inactive",
    biography: "Aisha manages international youth exchange programs and facilitates leadership camps across multiple countries.",
    expertiseAreas: "Exchange Programs, Youth Leadership, Facilitation",
    photoUrl: "/img/mock/speaker-aisha.jpg",
    linkedInUrl: "https://www.linkedin.com/in/aisharahman",
    sessionTitle: "Building Sustainable Youth Networks",
    sessionTime: "Day 2, 10:00 - 11:30",
    sessionDescription: "An interactive session on how to maintain and grow international youth communities.",
  },
];

export default async function ProgramSpeakersPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ search?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.search?.toLowerCase() || "";

  const filteredData = MOCK_SPEAKERS.filter((speaker) => {
    if (!searchQuery) return true;
    return (
      speaker.name.toLowerCase().includes(searchQuery) ||
      (speaker.title ?? "").toLowerCase().includes(searchQuery) ||
      (speaker.organization ?? "").toLowerCase().includes(searchQuery) ||
      speaker.type.toLowerCase().includes(searchQuery) ||
      (speaker.sessionTitle ?? "").toLowerCase().includes(searchQuery) ||
      speaker.status.toLowerCase().includes(searchQuery)
    );
  });

  const totalSpeakers = MOCK_SPEAKERS.length;
  const totalKeynote = MOCK_SPEAKERS.filter((s) => s.type === "Keynote").length;
  const totalRegular = MOCK_SPEAKERS.filter((s) => s.type === "Regular").length;
  const totalWithSession = MOCK_SPEAKERS.filter((s) => s.sessionTitle && s.sessionTitle.trim() !== "").length;

  return (
    <div className="space-y-4">
      <ProgramSpeakersHeader 
        totalSpeakers={totalSpeakers}
        totalKeynote={totalKeynote}
        totalRegular={totalRegular}
        totalWithSession={totalWithSession}
      />
      
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <ProgramSpeakersTable data={filteredData} currentSearch={searchQuery} />
      </section>
    </div>
  );
}