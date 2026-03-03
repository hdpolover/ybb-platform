import Image from "next/image";
import { AddPhotoAction, EditPhotoAction, DeletePhotoAction } from "./PhotoActions";

export type ProgramPhoto = {
  id: number;
  title: string;
  year: string;
  imageUrl: string;
  description: string;
};

export function ProgramPhotosGallery({ data }: { data: ProgramPhoto[] }) {
  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900">Photo Gallery</h2>
          <p className="text-sm text-zinc-500">
            Manage highlight photos and short descriptions for this program.
          </p>
        </div>
        {/* LEAF CLIENT COMPONENT */}
        <AddPhotoAction />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-zinc-700">No photos added yet</p>
            <p className="mt-1.5 max-w-sm text-xs text-zinc-500 leading-relaxed">
              Start building your gallery by uploading highlight photos from program activities.
            </p>
          </div>
        ) : (
          data.map((photo) => (
            <article
              key={photo.id}
              className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative h-48 w-full bg-zinc-100 border-b border-zinc-200">
                <Image
                  src={photo.imageUrl}
                  alt={photo.title}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-zinc-900 line-clamp-2">
                    {photo.title}
                  </h3>
                  <p className="text-xs font-medium text-zinc-500">{photo.year}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-700 line-clamp-3">
                    {photo.description}
                  </p>
                </div>
                
                <div className="mt-5 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
                  {/* LEAF CLIENT COMPONENTS */}
                  <EditPhotoAction photo={photo} />
                  <DeletePhotoAction id={photo.id} />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

// TODO: Nanti disambungin ke implementasi ProgramPhotosGallery beneran (nyatu sama data asli)
