import {
  IdentificationIcon,
  PhotoIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/solid";
import { sanitizeHtml } from "@/lib/sanitize-html";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export interface GeneralInformationData {
  brandName: string;
  programType: string;
  programFormat: string;
  tagline: string;
  media: {
    logo: string | null;
    mainBanner: string | null;
    mainVideoUrl: string;
  };
  description: string;
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
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Program Format</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.programFormat}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Tagline</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">
              {data.tagline}
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
            {data.media.mainVideoUrl && data.media.mainVideoUrl !== "Not configured" ? (
              <dd className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
                {(() => {
                  const ytId = extractYouTubeId(data.media.mainVideoUrl);
                  return (
                    <>
                      {ytId ? (
                        <div className="relative h-24 w-full overflow-hidden bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                            alt="Video thumbnail"
                            className="h-full w-full object-cover opacity-90"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-0.5">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-24 items-center justify-center bg-zinc-100 text-xs text-zinc-400">
                          No preview available
                        </div>
                      )}
                      <a
                        href={data.media.mainVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <span className="truncate">{data.media.mainVideoUrl}</span>
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </>
                  );
                })()}
              </dd>
            ) : (
              <dd className="flex h-24 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-xs text-zinc-400 shadow-sm">
                Not configured
              </dd>
            )}
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
          <div
            className="[&_a]:text-blue-600 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-200 [&_blockquote]:pl-4 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-zinc-100 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.description) }}
          />
        </div>
      </section>
    </div>
  );
}