import { UserCircleIcon, UsersIcon } from "@heroicons/react/24/solid";

interface ProgramSpeakersHeaderProps {
  totalSpeakers: number;
  totalKeynote: number;
  totalRegular: number;
  totalWithSession: number;
}

export function ProgramSpeakersHeader({
  totalSpeakers,
  totalKeynote,
  totalRegular,
  totalWithSession
}: ProgramSpeakersHeaderProps) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <UsersIcon className="h-5 w-5" />
            </span>
            <span>Program Speakers Overview</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Overview of all keynote and regular speakers, their profiles, and assigned sessions for
            this program.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Total Speakers
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              <UserCircleIcon className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">{totalSpeakers}</div>
          <div className="mt-1 text-xs text-zinc-500">Registered for this program</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Keynote Speakers
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <UserCircleIcon className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">{totalKeynote}</div>
          <div className="mt-1 text-xs text-zinc-500">Highlight sessions & keynotes</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Regular Speakers
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <UserCircleIcon className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">{totalRegular}</div>
          <div className="mt-1 text-xs text-zinc-500">Workshops, panels, and sessions</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              With Sessions
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <UserCircleIcon className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">{totalWithSession}</div>
          <div className="mt-1 text-xs text-zinc-500">Already assigned to a session</div>
        </div>
      </div>
    </section>
  );
}