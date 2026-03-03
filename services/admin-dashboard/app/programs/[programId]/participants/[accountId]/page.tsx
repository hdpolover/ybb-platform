import Link from "next/link";
import { ProfileHeader, ProfileHeaderData } from "@/app/components/participants/ProfileHeader";
import { ParticipantProfileTabs } from "@/app/components/participants/ParticipantProfileTabs";
import { PersonalDetails } from "@/app/components/participants/tabs/PersonalDetailsTab";
import { ProfessionalProfile } from "@/app/components/participants/tabs/ProfessionalProfileTab";
import { EntryInformation } from "@/app/components/participants/tabs/EntryInformationTab";
import { Miscellaneous } from "@/app/components/participants/tabs/MiscellaneousTab";

interface ParticipantData extends ProfileHeaderData {
  id: string;
  personal: PersonalDetails;
  professional: ProfessionalProfile;
  entry: EntryInformation;
  misc: Miscellaneous;
}

const MOCK_PARTICIPANT: ParticipantData = {
  id: "20099",
  accountId: "73112691dc7bf42fe3",
  name: "YAWSON SAMUEL",
  avatarUrl: "",
  email: "ahagpi2002@gmail.com",
  phone: "+6182392830282",
  location: "Sleman, Yogyakarta",
  personal: {
    fullName: "Aldi Subakti",
    nickname: "Aldi",
    gender: "Male",
    birthDate: "12 December 1998",
    nationality: "Indonesia",
    originAddress: "Jl. Pahlawan No 1, Sleman, Yogyakarta",
    currentAddress: "Jl. Pahlawan No 2, Sleman, Yogyakarta",
    phone: "0823923903282",
    emergencyPhone: "0892971287192",
    contactRelation: "Father",
    shirtSize: "XL",
    diseaseHistory: "-",
  },
  professional: {
    educationLevel: "Master's Degree",
    institution: "University of Brawijaya",
    major: "Information Systems",
    organization: "BEM KM Universitas Brawijaya",
    experience: [
      { role: "Data Analyst", company: "Telkom" },
      { role: "System Analyst Intern", company: "Data Academy" }
    ],
    achievements: [
      "1st Place Winner, National Information Systems Competition",
      "Finalist, National IT Business Case Competition",
      "Certified IT Support Specialist"
    ],
    cvFileName: "CV_Aldi Subakti.pdf"
  },
  entry: {
    category: "High School Innovators",
    subtheme: "SDG 17 (Partnership for the Goals)",
    source: "Friend Recommendation",
    essayTitle: "Muslim Contributions to Justice",
    essayContent: "Muslim Contributions to Justice, Inclusion, and Sustainability in a Complex World requires...",
    keywords: ["User Experience", "User Interface", "Muslims", "Society", "Sustainability"],
    reference: "Muslim Contributions to Justice"
  },
  misc: {
    instagram: "https://instagram.com/yawonsml",
    knowledgeSource: "Friend Recommendation",
    sourceAccount: "Friend Recommendation",
    twibbon: "https://instagram.com/yawonsml",
    requirementLink: "https://requirementkys2026.com",
    referralCode: "KYS7283913"
  }
};

export default async function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ programId: string; accountId: string }>;
}) {
  const { programId, accountId } = await params;
  
  // Simulasi fetch API
  const participant = MOCK_PARTICIPANT;

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
        <Link href={`/programs/${programId}/dashboard`} className="hover:text-zinc-800 transition-colors">Dashboard</Link>
        <span>&gt;</span>
        <span className="font-semibold text-blue-600">Detail Participant</span>
      </div>

      <div className="w-full min-h-[600px] rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <ProfileHeader data={participant} />
        <ParticipantProfileTabs data={participant} />
      </div>
    </div>
  );
}