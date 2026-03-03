import {
  IdentificationIcon,
  PhotoIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";

export interface ProgramSpecificsData {
  programName: string;
  theme: string;
  description: string;
  datesAndStatus: {
    startDate: string;
    endDate: string;
    status: string;
    registrationStatus: string;
  };
  media: {
    bannerImage: string;
    registrationVideoUrl: string;
    twibbonVideoUrl: string;
    tshirtChartUrl: string;
    twibbonUrl: string;
  };
  content: {
    guidelineUrl: string;
    essayGuidelineUrl: string;
    mainEssayQuestion: string;
    shareDescription: string;
    confirmationDescription: string;
  };
}

export function ProgramSpecificsTab({ data }: { data: ProgramSpecificsData }) {
  return (
    <div className="space-y-6 pt-2">
      {/* Identitas Program */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              1
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Basic Information</h2>
              <p className="text-xs text-zinc-500">
                Program name, theme, and identity for this specific cohort.
              </p>
            </div>
          </div>
          <IdentificationIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-2">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Name</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.programName}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Theme</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.theme}
            </dd>
          </div>
        </dl>
      </section>

      {/* Deskripsi */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              2
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Description</h2>
              <p className="text-xs text-zinc-500">Program-specific description for this cohort.</p>
            </div>
          </div>
          <DocumentTextIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
          {data.description}
        </div>
      </section>

      {/* Status & Dates */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              3
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Dates &amp; Status</h2>
              <p className="text-xs text-zinc-500">Program schedule and registration status.</p>
            </div>
          </div>
          <CalendarDaysIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-4">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Start Date</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.datesAndStatus.startDate}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">End Date</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.datesAndStatus.endDate}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Status</dt>
            <dd className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
              {data.datesAndStatus.status}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration</dt>
            <dd className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
              {data.datesAndStatus.registrationStatus}
            </dd>
          </div>
        </dl>
      </section>

      {/* Asset Media */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              4
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Media &amp; Assets</h2>
              <p className="text-xs text-zinc-500">Program-specific promotional assets.</p>
            </div>
          </div>
          <PhotoIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-2 lg:col-span-1">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Banner Image</dt>
            <dd className="flex h-24 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white px-2 text-center text-xs font-medium text-zinc-500">
              {data.media.bannerImage}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Registration Video URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.media.registrationVideoUrl}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Twibbon Video URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.media.twibbonVideoUrl}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">T-Shirt Chart URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.media.tshirtChartUrl}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Twibbon URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.media.twibbonUrl}
            </dd>
          </div>
        </dl>
      </section>

      {/* Program Content */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              5
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Program Content</h2>
              <p className="text-xs text-zinc-500">Guidelines, essay information, and share flows.</p>
            </div>
          </div>
          <DocumentTextIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>
        
        <dl className="grid gap-5 md:grid-cols-2">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Guideline URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.content.guidelineUrl}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Essay Guideline URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.content.essayGuidelineUrl}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Main Essay Question</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.content.mainEssayQuestion}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Share Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
              {data.content.shareDescription}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Confirmation Description</dt>
            <dd className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
              {data.content.confirmationDescription}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}