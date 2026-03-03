import Image from "next/image";
import { CheckCircleIcon, PlayCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { 
  VideoSearch, 
  AddVideoAction, 
  ViewVideoAction, 
  EditVideoAction, 
  DeleteVideoAction 
} from "./VideoActions";

export type VideoTestimonyRow = {
  id: number;
  thumbnailUrl?: string;
  youtubeUrl: string;
  description: string;
  status: "active" | "inactive";
};

export function VideoTestimonialsTable({ 
  data, 
  currentSearch 
}: { 
  data: VideoTestimonyRow[], 
  currentSearch: string 
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
        {/* LEAF CLIENT COMPONENT */}
        <AddVideoAction />
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          {/* LEAF CLIENT COMPONENT */}
          <VideoSearch initialSearch={currentSearch} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="w-32 px-6 py-4 font-semibold">Thumbnail</th>
              <th className="px-6 py-4 font-semibold">YouTube URL</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="w-32 px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No video testimonials configured yet.
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 shadow-sm">
                      {row.thumbnailUrl ? (
                        <Image src={row.thumbnailUrl} alt="Video thumbnail" width={96} height={64} className="h-full w-full object-cover" />
                      ) : (
                        <PlayCircleIcon className="h-8 w-8 text-zinc-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="max-w-xs break-all text-sm font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 md:max-w-sm">
                      {row.youtubeUrl}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="max-w-md text-sm text-zinc-700 line-clamp-3 md:max-w-xl leading-relaxed">
                      {row.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${row.status === "active" ? "bg-emerald-50 text-emerald-700 " : "bg-zinc-50 text-zinc-600 "}`}>
                      {/* {row.status === "active" ? (
                        <CheckCircleIcon className="h-4 w-4" />
                      ) : (
                        <XCircleIcon className="h-4 w-4" />
                      )} */}
                      <span>{row.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      {/* LEAF CLIENT COMPONENTS */}
                      <ViewVideoAction row={row} />
                      <EditVideoAction row={row} />
                      <DeleteVideoAction id={row.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// TODO: Nanti implement VideoTestimonialsTable lengkap ngikutin pattern ProgramTestimoniesTable