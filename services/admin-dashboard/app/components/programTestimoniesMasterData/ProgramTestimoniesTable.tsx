import Image from "next/image";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { 
  TestimonySearch, 
  AddTestimonyAction, 
  EditTestimonyAction, 
  DeleteTestimonyAction 
} from "./TestimonyActions";

export type ProgramTestimonyRow = {
  id: number;
  name: string;
  role: string;
  country: string;
  photoUrl?: string;
  testimony: string;
};

export function ProgramTestimoniesTable({ 
  data, 
  currentSearch 
}: { 
  data: ProgramTestimonyRow[], 
  currentSearch: string 
}) {
  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Program Testimonies</h2>
          <p className="text-sm text-zinc-500">
            Manage testimonial stories from delegates and alumni for this program.
          </p>
        </div>
        {/* LEAF CLIENT COMPONENT */}
        <AddTestimonyAction />
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Search</label>
          {/* LEAF CLIENT COMPONENT */}
          <TestimonySearch initialSearch={currentSearch} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="w-12 px-6 py-4 font-semibold">No</th>
              <th className="w-20 px-6 py-4 font-semibold">Photo</th>
              <th className="px-6 py-4 font-semibold">Person Details</th>
              <th className="px-6 py-4 font-semibold">Testimony</th>
              <th className="px-6 py-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                  No testimonies configured yet.
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-6 py-4 align-top text-xs font-medium text-zinc-500">{index + 1}</td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50">
                      {row.photoUrl ? (
                        <Image src={row.photoUrl} alt={row.name} width={48} height={48} className="h-12 w-12 object-cover" />
                      ) : (
                        <UserCircleIcon className="h-10 w-10 text-zinc-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-900">{row.name}</div>
                      <div className="text-xs text-zinc-500">{row.role}</div>
                      <div className="text-xs font-medium text-zinc-600">{row.country}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="max-w-md text-sm leading-relaxed text-zinc-700 line-clamp-4 md:max-w-xl">
                      {row.testimony}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      {/* LEAF CLIENT COMPONENTS */}
                      <EditTestimonyAction testimony={row} />
                      <DeleteTestimonyAction id={row.id} />
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