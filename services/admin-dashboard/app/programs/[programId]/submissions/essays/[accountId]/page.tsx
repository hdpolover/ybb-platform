"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EssayDetailHeader } from "@/app/components/submissions/EssayDetailHeader";
import {
  DocumentTextIcon,
  PencilSquareIcon,
  Bars3BottomLeftIcon,
  ClockIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/solid";

export default function EssayDetailPage({
  params,
}: {
  params: Promise<{ programId: string; accountId: string }>;
}) {
  const { programId, accountId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // TODO: replace static dummy data with real data from API
  const name = "ARMANDO MATIAS BUENGA";
  const email = "armandombuenga@gmail.com";
  const participantId = "174031";
  const category = "Fully Funded" as const;

  const [isTitleOpen, setIsTitleOpen] = useState(true);
  const [isEssayOpen, setIsEssayOpen] = useState(true);
  const [isReferencesOpen, setIsReferencesOpen] = useState(true);

  const handleViewProfile = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", "essays");
    const query = params.toString();
    const basePath = `/programs/${encodeURIComponent(programId)}/participants/${encodeURIComponent(accountId)}`;
    router.push(query ? `${basePath}?${query}` : basePath);
  };

  return (
    <div className="space-y-4">
      <EssayDetailHeader
        name={name}
        email={email}
        participantId={participantId}
        category={category}
        onViewProfile={handleViewProfile}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total Essays</div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <DocumentTextIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">3</div>
          <div className="mt-1 text-[11px] text-zinc-500">Configured essay assignments</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Answered</div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <PencilSquareIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">3</div>
          <div className="mt-1 text-[11px] text-zinc-500">Completed essay responses</div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total Words</div>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <Bars3BottomLeftIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">1,147</div>
          <div className="mt-1 text-[11px] text-zinc-500">Approximate word count across essays</div>
        </div>
      </section>

      {/* Essay Answers */}
      <section className="space-y-4">
        {/* Title of your essay */}
        <article className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <header className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <DocumentTextIcon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-900">Title of your essay</h2>
              <p className="text-[11px] text-zinc-500">As written by the participant in the application form.</p>
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              onClick={() => setIsTitleOpen((previous) => !previous)}
            >
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${isTitleOpen ? "rotate-180" : "rotate-0"}`}
              />
            </button>
          </header>

          {isTitleOpen && (
            <>
              <p className="text-sm text-zinc-700">
                Building Youth-Led Climate Resilience Through Community-Based Renewable Energy and Inclusive Education
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-zinc-200 pt-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Bars3BottomLeftIcon className="h-3.5 w-3.5" />
                  <span>10 words</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5" />
                  <span>103 characters</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span>Submitted on Dec 3, 2025</span>
                </span>
              </div>
            </>
          )}
        </article>

        {/* Main SDG question + answer */}
        <article className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <header className="mb-3 flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <PencilSquareIcon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-900">SDG Focus Essay</h2>
              <p className="text-[11px] text-zinc-500">
                As a youth leader, how have you contributed — or how do you plan to contribute — to advancing
                solutions within your chosen SDG focus area to create sustainable and inclusive change in your
                community or beyond?
              </p>
            </div>
            <button
              type="button"
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              onClick={() => setIsEssayOpen((previous) => !previous)}
            >
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${isEssayOpen ? "rotate-180" : "rotate-0"}`}
              />
            </button>
          </header>

          {isEssayOpen && (
            <>
              <div className="space-y-2 text-sm leading-relaxed text-zinc-700">
                <p>
                  Growing up in a coastal community in Luanda, I witnessed how floods and unreliable electricity
                  disproportionately affected low-income families. Street vendors could not keep food refrigerated,
                  students studied under dim candlelight, and frequent power cuts damaged essential medical
                  equipment in small clinics. These experiences shaped my commitment to SDG 7 (Affordable and Clean
                  Energy) and SDG 13 (Climate Action), and inspired me to build youth-led, community-based
                  solutions.
                </p>
                <p>
                  Over the past two years, I co-founded a youth initiative called <span className="font-semibold">Energia Jovem</span>, which
                  trains secondary school students to design and assemble small solar lanterns using locally
                  available components. Working with teachers and a local technical college, we organised weekend
                  workshops where students learned basic electrical safety, solar technology, and project
                  management. So far, we have produced more than 120 lanterns that are loaned to students from
                  households without reliable electricity, allowing them to extend their study time by an average of
                  two hours per day without using kerosene lamps.
                </p>
                <p>
                  Beyond distributing lanterns, we encourage participants to become advocates in their own
                  neighbourhoods. Each team of students is responsible for running a household energy survey,
                  collecting data on lighting sources, monthly energy expenses, and health issues related to indoor
                  air pollution. They present their findings in school assemblies and community meetings, using
                  simple infographics that we co-create. This process has not only raised awareness of the hidden
                  costs of fossil-based lighting, but has also given young people concrete evidence to present to
                  local authorities and private sponsors.
                </p>
                <p>
                  In the next 12 months, I plan to expand Energia Jovem into a social enterprise model. We are
                  piloting a “pay-as-you-learn” scheme where families contribute a very small fee over several
                  months, which is reinvested into buying higher-quality components and training more youth
                  technicians. At the same time, we are partnering with a women-led cooperative to assemble
                  wooden casings for the lanterns from responsibly sourced off-cuts, linking our work to SDG 8
                  (Decent Work) and SDG 12 (Responsible Consumption and Production). My long-term goal is to create
                  a replicable toolkit—curriculum modules, open-source designs, and monitoring templates—that other
                  schools in Angola and Lusophone Africa can adopt to launch their own youth-led clean energy
                  projects.
                </p>
                <p>
                  Through this combination of practical skills, data-driven advocacy, and community ownership, I
                  believe young people can move from being passive beneficiaries of development projects to active
                  co-creators of climate-resilient, low-carbon futures in their communities and beyond.
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-zinc-200 pt-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Bars3BottomLeftIcon className="h-3.5 w-3.5" />
                  <span>~520 words</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5" />
                  <span>~3,200 characters</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span>Submitted on Dec 3, 2025</span>
                </span>
              </div>
            </>
          )}
        </article>

        {/* References */}
        <article className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <header className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-600">
              <Bars3BottomLeftIcon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-900">References</h2>
              <p className="text-[11px] text-zinc-500">Key documents, reports, and sources cited in the essay.</p>
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
              onClick={() => setIsReferencesOpen((previous) => !previous)}
            >
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${isReferencesOpen ? "rotate-180" : "rotate-0"}`}
              />
            </button>
          </header>

          {isReferencesOpen && (
            <>
              <ul className="space-y-1.5 text-[13px] leading-snug text-zinc-700">
                <li>
                  1. International Renewable Energy Agency (IRENA). (2023). <span className="italic">Off-grid Renewable Energy
                  Solutions in Sub-Saharan Africa</span>.
                </li>
                <li>
                  2. United Nations Development Programme. (2022). <span className="italic">Youth and Climate Action: Best
                  Practices from Africa</span>.
                </li>
                <li>
                  3. Ministério da Energia e Águas de Angola. (2021). <span className="italic">Plano de Desenvolvimento do
                  Sector Eléctrico 2020–2025</span>.
                </li>
                <li>
                  4. World Health Organization. (2021). <span className="italic">Household Air Pollution and Health</span>. Factsheet.
                </li>
                <li>
                  5. Sustainable Energy for All. (2020). <span className="italic">Leaving No One Behind in Access to Energy</span>.
                </li>
                <li>
                  6. Energia Jovem internal survey data (2024), collected from 60 households in Luanda’s coastal
                  neighbourhoods.
                </li>
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed border-zinc-200 pt-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Bars3BottomLeftIcon className="h-3.5 w-3.5" />
                  <span>6 references</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span>Last updated Dec 3, 2025</span>
                </span>
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  );
}
