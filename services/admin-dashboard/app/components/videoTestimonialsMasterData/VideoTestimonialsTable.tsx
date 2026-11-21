import { PlayCircleIcon } from "@heroicons/react/24/solid";
import {
  VideoSearch,
  AddVideoAction,
  ViewVideoAction,
  EditVideoAction,
  DeleteVideoAction,
} from "./VideoActions";
import { parseVideoUrl, VIDEO_PLATFORM_LABEL } from "./video-platform";

export type VideoTestimonyRow = {
  id: string;
  name: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  description: string;
  isActive: boolean;
};

export function VideoTestimonialsTable({
  data,
  loading,
  programId,
  brandId,
  canWrite,
  search,
  onSearchChange,
  onRefresh,
}: {
  data: VideoTestimonyRow[];
  loading: boolean;
  programId: string;
  brandId: string;
  canWrite: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Video Testimonials</h2>
          <p className="text-sm text-zinc-500">
            Manage video testimonials embedded on the program landing pages.
          </p>
        </div>
        {canWrite && <AddVideoAction programId={programId} brandId={brandId} onSuccess={onRefresh} />}
      </div>

      {/* Search */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
        <VideoSearch value={search} onChange={onSearchChange} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="w-32 px-6 py-4 font-semibold">Thumbnail</th>
              <th className="px-6 py-4 font-semibold">Video URL</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="w-32 px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-400">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No video testimonials configured yet.
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const parsed = parseVideoUrl(row.videoUrl);
                const thumb = row.thumbnailUrl ?? parsed?.thumbnailUrl ?? null;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 shadow-sm">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt="Video thumbnail"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <PlayCircleIcon className="h-8 w-8 text-zinc-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {parsed ? VIDEO_PLATFORM_LABEL[parsed.platform] : "Unsupported link"}
                      </div>
                      <a
                        href={row.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-xs break-all text-sm font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 md:max-w-sm"
                      >
                        {row.videoUrl}
                      </a>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="max-w-md text-sm leading-relaxed text-zinc-700 line-clamp-3 md:max-w-xl">
                        {row.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <span
                        className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                          row.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-top text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <ViewVideoAction row={row} />
                        {canWrite && (
                          <>
                            <EditVideoAction row={row} onSuccess={onRefresh} />
                            <DeleteVideoAction id={row.id} onSuccess={onRefresh} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
