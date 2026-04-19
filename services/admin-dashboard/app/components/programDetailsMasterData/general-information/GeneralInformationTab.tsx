import {
  IdentificationIcon,
  PhotoIcon,
  GlobeAltIcon,
  PhoneIcon,
  AtSymbolIcon,
  HeartIcon,
  FlagIcon,
  PlayCircleIcon,
  GiftTopIcon,
} from "@heroicons/react/24/solid";

export interface GeneralInformationData {
  brandName: string;
  programType: string;
  tagline: string;
  websiteUrl: string;
  media: {
    logo: string | null;
    mainBanner: string | null;
    mainVideoUrl: string;
  };
  description: string;
  contact: {
    team: string;
    location: string;
    email: string;
  };
  socialMedia: {
    instagram: string;
    tiktok: string;
    youtube: string;
    telegram: string;
    sponsorCanva: string;
  };
  additionalInfo: string;
  coreValues: {
    vision: string;
    mission: string[];
  };
  objectives: string[];
  benefits: string[];
}

export function GeneralInformationTab({ data }: { data: GeneralInformationData }) {
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
              <h2 className="text-base font-bold text-zinc-900">Program Identity</h2>
              <p className="text-xs text-zinc-500">
                Key identifiers that will appear across landing pages and communication.
              </p>
            </div>
          </div>
          <IdentificationIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>
        
        <dl className="grid gap-5 md:grid-cols-2">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Brand Name</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.brandName}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Type</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.programType}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Tagline</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.tagline}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Website URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm">
              {data.websiteUrl}
            </dd>
          </div>
        </dl>
      </section>

      {/* Asset Media */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              2
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Media Assets</h2>
              <p className="text-xs text-zinc-500">
                Visual assets used on program pages and promotional materials.
              </p>
            </div>
          </div>
          <PhotoIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-3">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Logo Image</dt>
            <dd className="flex h-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-zinc-300 bg-white">
              {data.media.logo ? (
                <img src={data.media.logo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-zinc-400">Not configured</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Main Banner Image</dt>
            <dd className="flex h-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-zinc-300 bg-white">
              {data.media.mainBanner ? (
                <img src={data.media.mainBanner} alt="Main Banner" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-zinc-400">Not configured</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Main Video URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.media.mainVideoUrl}
            </dd>
          </div>
        </dl>
      </section>

      {/* Deskripsi Program */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              3
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Program Description</h2>
              <p className="text-xs text-zinc-500">High-level overview of the program for landing pages.</p>
            </div>
          </div>
          <GlobeAltIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
          {data.description}
        </div>
      </section>

      {/* Informasi Kontak */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              4
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Contact Information</h2>
              <p className="text-xs text-zinc-500">Primary contact for participants and partners.</p>
            </div>
          </div>
          <PhoneIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Contact Team</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.contact.team}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Location</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.contact.location}
            </dd>
          </div>
          <div className="md:col-span-3 lg:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Email</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.contact.email}
            </dd>
          </div>
        </dl>
      </section>

      {/* Bagian Sosmed */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              5
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Social Media</h2>
              <p className="text-xs text-zinc-500">Official program social channels and assets.</p>
            </div>
          </div>
          <AtSymbolIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Instagram</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.socialMedia.instagram}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">TikTok</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.socialMedia.tiktok}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">YouTube</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.socialMedia.youtube}
            </dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Telegram</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.socialMedia.telegram}
            </dd>
          </div>
          <div className="lg:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Sponsor Canva URL</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-sm break-all">
              {data.socialMedia.sponsorCanva}
            </dd>
          </div>
        </dl>
      </section>

      {/* Informasi Tambahan */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              6
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Additional Information</h2>
              <p className="text-xs text-zinc-500">Supporting narrative about the program.</p>
            </div>
          </div>
          <HeartIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-800 shadow-sm">
          {data.additionalInfo}
        </div>
      </section>

      {/* Core Values */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              7
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Core Values</h2>
              <p className="text-xs text-zinc-500">Vision and mission specific to this program.</p>
            </div>
          </div>
          <FlagIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Vision</dt>
            <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-sm leading-relaxed text-zinc-800">
                {data.coreValues.vision}
              </p>
            </div>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Mission</dt>
            <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
              <ul className="list-inside list-disc space-y-1 text-sm leading-relaxed text-zinc-800">
                {data.coreValues.mission.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              8
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Objectives</h2>
              <p className="text-xs text-zinc-500">
                The Japan Youth Summit program is held to achieve the following objectives.
              </p>
            </div>
          </div>
          <PlayCircleIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-800">
            {data.objectives.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Benefits */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              9
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Benefits</h2>
              <p className="text-xs text-zinc-500">Key benefits that will be highlighted to delegates.</p>
            </div>
          </div>
          <GiftTopIcon className="hidden h-6 w-6 text-blue-400 md:block" />
        </div>

        <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
          <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-zinc-800">
            {data.benefits.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}