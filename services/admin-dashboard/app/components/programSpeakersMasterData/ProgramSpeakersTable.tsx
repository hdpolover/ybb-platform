import Image from "next/image";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { SpeakerSearch, AddSpeakerAction, ViewSpeakerAction, EditSpeakerAction, DeleteSpeakerAction } from "./ProgramSpeakerActions";

export type SpeakerType = "Regular" | "Keynote";
export type SpeakerStatus = "Active" | "Inactive";

export type ProgramSpeaker = {
  id: number;
  name: string;
  title?: string;
  organization?: string;
  email?: string;
  type: SpeakerType;
  status: SpeakerStatus;
  biography?: string;
  expertiseAreas?: string;
  photoUrl?: string;
  linkedInUrl?: string;
  instagramUrl?: string;
  sessionTitle?: string;
  sessionTime?: string;
  sessionDescription?: string;
};

export function ProgramSpeakersTable({ 
  data, 
  currentSearch 
}: { 
  data: ProgramSpeaker[], 
  currentSearch: string 
}) {
  return (
    <div className="space-y-5">
      {/* Search & Add Action Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search Speakers</label>
          <div className="flex w-full gap-3">
            {/* LEAF CLIENT COMPONENT */}
            <SpeakerSearch initialSearch={currentSearch} />
            <AddSpeakerAction />
          </div>
        </div>
      </div>

      {/* Grid Layout (Server Rendered) */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-zinc-900">No speakers found</p>
            <p className="mt-1 text-xs text-zinc-500">
              Try adjusting your search terms or add a new speaker.
            </p>
          </div>
        ) : (
          data.map((speaker, index) => (
            <article
              key={speaker.id}
              className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Header Image */}
              <div className="relative h-40 w-full bg-zinc-100">
                {speaker.photoUrl ? (
                  <Image
                    src={speaker.photoUrl}
                    alt={speaker.name}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                    <UserCircleIcon className="h-16 w-16" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">{speaker.name}</h3>
                    <div className="mt-1 text-sm text-zinc-500">
                      {speaker.title}
                      {speaker.title && speaker.organization ? " · " : ""}
                      {speaker.organization}
                    </div>
                  </div>

                  {/* Badges*/}
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${speaker.type === "Keynote" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}>
                      {speaker.type} Speaker
                    </span>
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${speaker.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-50 text-zinc-600"}`}>
                      {speaker.status}
                    </span>
                  </div>

                  {(speaker.sessionTitle || speaker.sessionTime) && (
                    <div className="rounded-md bg-zinc-50 p-3 text-sm">
                      <div className="text-xs font-medium text-zinc-500 mb-1">Session Info</div>
                      <div className="font-semibold text-zinc-900 line-clamp-2">{speaker.sessionTitle}</div>
                      <div className="mt-1 text-xs text-zinc-500">{speaker.sessionTime}</div>
                    </div>
                  )}
                </div>

                {/* Actions (LEAF CLIENT COMPONENTS) */}
                <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
                  <ViewSpeakerAction speaker={speaker} />
                  <EditSpeakerAction speaker={speaker} />
                  <DeleteSpeakerAction id={speaker.id} />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}