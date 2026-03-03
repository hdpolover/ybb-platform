import { use } from "react";
import { HeaderSection } from "@/app/components/programDetailsMasterData/HeaderSection";
import { TabNavigation } from "@/app/components/programDetailsMasterData/TabNavigation";
import { EditGeneralAction } from "@/app/components/programDetailsMasterData/general-information/EditGeneralAction";
import { EditSpecificsAction } from "@/app/components/programDetailsMasterData/program-specifics/EditSpecificsAction";
import {
  GeneralInformationTab,
  GeneralInformationData,
} from "@/app/components/programDetailsMasterData/general-information/GeneralInformationTab";
import {
  ProgramSpecificsTab,
  ProgramSpecificsData,
} from "@/app/components/programDetailsMasterData/program-specifics/ProgramSpecificsTab";

const MOCK_PROGRAMS = [
  { id: "iys-2026", name: "Istanbul Youth Summit 2026" },
  { id: "iys-2025", name: "Istanbul Youth Summit 2025" },
  { id: "jys-2026", name: "Japan Youth Summit 2026" },
  { id: "kys-2026", name: "Korea Youth Summit 2026" },
  { id: "meys-2026", name: "Middle East Youth Summit 2026" },
  { id: "wys-2025", name: "World Youth Summit 2025" },
  { id: "yaf-2025", name: "Youth Academic Forum 2025" },
];

function getProgramName(programId: string | null): string {
  if (!programId) return "Selected Program";

  const program = MOCK_PROGRAMS.find((item) => item.id === programId);
  return program?.name ?? "Selected Program";
}

const MOCK_GENERAL_DATA: GeneralInformationData = {
  categoryName: "Youth Leadership & Cultural Immersion",
  programType: "Hybrid (Online Preparation + Onsite Program)",
  tagline:
    "Empowering young leaders to collaborate, innovate, and create global impact in Japan.",
  websiteUrl: "https://youthbreaktheboundaries.com/japan-youth-summit-2026",
  media: {
    logo: "Logo preview / URL placeholder",
    mainBanner: "Main banner preview / URL placeholder",
    mainVideoUrl: "https://youtu.be/example-jys-2026",
  },
  description:
    "Japan Youth Summit 2026 is a global youth forum that brings together emerging leaders from diverse backgrounds to discuss pressing global issues, experience Japanese culture, and collaborate on concrete youth-led initiatives.",
  contact: {
    team: "Youth Break the Boundaries (YBB) Program Team",
    location: "Tokyo, Japan",
    email: "support@youthbreaktheboundaries.com",
  },
  socialMedia: {
    instagram: "https://instagram.com/japanyouthsummit",
    tiktok: "https://tiktok.com/@japanyouthsummit",
    youtube: "https://youtube.com/@youthbreaktheboundaries",
    telegram: "https://t.me/jys2026_official",
    sponsorCanva: "https://www.canva.com/design/jys-2026-sponsorship-kit",
  },
  additionalInfo:
    "Japan Youth Summit is part of Youth Break the Boundaries' global flagship programs, designed to create a safe, inclusive, and collaborative space for young leaders who are passionate about SDGs, diplomacy, and cross-cultural understanding.",
  coreValues: {
    vision:
      "To become a leading youth platform that empowers young leaders to collaborate and co-create innovative solutions for global challenges through meaningful engagement in Japan.",
    mission: [
      "Facilitate intercultural dialogue and collaboration among youth leaders.",
      "Promote understanding of Japanese culture, innovation, and diplomacy.",
      "Encourage youth-led initiatives aligned with the Sustainable Development Goals.",
    ],
  },
  objectives: [
    "Provide a platform for youth to present and discuss solutions to global challenges.",
    "Strengthen leadership, negotiation, and public speaking skills of participants.",
    "Build an international network of young leaders and changemakers.",
    "Expose participants to Japanese culture, innovation, and best practices.",
  ],
  benefits: [
    "International symposium and panel discussion with experts and practitioners.",
    "Cultural immersion activities and city tour in Tokyo or surrounding areas.",
    "Certificate of participation and potential award recognition.",
    "Access to YBB global alumni network and future program opportunities.",
  ],
};

const MOCK_SPECIFICS_DATA: ProgramSpecificsData = {
  programName: "Japan Youth Summit 2026",
  theme: "Empowering Youth Collaboration for Global Impact",
  description:
    "Japan Youth Summit 2026 focuses on youth-led innovation, diplomacy, and collaboration to address global challenges through intensive discussions, cultural immersion, and project-based activities in Japan.",
  datesAndStatus: {
    startDate: "11 May 2026",
    endDate: "14 May 2026",
    status: "Active",
    registrationStatus: "Open",
  },
  media: {
    bannerImage: "Program-specific banner preview",
    registrationVideoUrl: "https://youtu.be/registration-video",
    twibbonVideoUrl: "https://youtu.be/twibbon-video",
    tshirtChartUrl: "https://ybb.link/jys-2026-tshirt-chart",
    twibbonUrl: "https://ybb.link/jys-2026-twibbon",
  },
  content: {
    guidelineUrl: "https://ybb.link/jys-2026-guideline",
    essayGuidelineUrl: "https://ybb.link/jys-2026-essay-guideline",
    mainEssayQuestion:
      "How can youth-led collaboration between countries contribute to solving global challenges such as climate change, inequality, and technological disruption? Provide concrete examples and proposed initiatives?",
    shareDescription:
      "Note: As mentioned in the Registration Guidelines, you need to complete the following steps...",
    confirmationDescription:
      "Japan Youth Summit 2026 — The Japan Youth Summit provides both Fully Funded and Self-Funded Opportunities...",
  },
};

export default async function ProgramDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const programId = resolvedParams.programId;
  const programName = getProgramName(programId);
  const activeTab = resolvedSearchParams.tab || "general";

  return (
    <main className="space-y-4">
      <HeaderSection programName={programName} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <TabNavigation activeTab={activeTab} />

          {activeTab === "general" ? (
            <EditGeneralAction programName={programName} />
          ) : (
            <EditSpecificsAction programName={programName} />
          )}
        </div>

        <div className="border-t border-zinc-100 pt-4">
          {activeTab === "general" ? (
            <GeneralInformationTab data={MOCK_GENERAL_DATA} />
          ) : (
            <ProgramSpecificsTab data={MOCK_SPECIFICS_DATA} />
          )}
        </div>
      </section>
    </main>
  );
}
