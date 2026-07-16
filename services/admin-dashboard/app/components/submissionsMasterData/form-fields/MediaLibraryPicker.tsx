"use client";

import { useCallback, useEffect, useState } from "react";
import { PhotoIcon, DocumentIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import { listProgramMedia, type MediaFile } from "@/src/shared/api-client";

interface MediaLibraryPickerProps {
  open: boolean;
  onClose: () => void;
  programId: string;
  brandId: string;
  /** If set, the filter pill defaults to this asset type (gallery/logo/banner/image/document). */
  defaultAssetType?: string;
  /** Called when the user clicks a file. The component closes itself. */
  onPick: (file: MediaFile) => void;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "image", label: "Images" },
  { key: "document", label: "Documents" },
  { key: "gallery", label: "Gallery" },
  { key: "logo", label: "Logos" },
  { key: "banner", label: "Banners" },
];

function isImageFile(file: MediaFile): boolean {
  return file.content_type?.startsWith("image/") ?? false;
}

/**
 * Browse + pick a file from the program's existing media library. Use this
 * wherever a form needs a "choose image" affordance instead of forcing admins
 * to type a URL. The picker fetches program-scoped media and calls `onPick`
 * with the full MediaFile (caller decides what field to use — typically
 * `url` for public consumption).
 */
export function MediaLibraryPicker({
  open,
  onClose,
  programId,
  brandId,
  defaultAssetType = "image",
  onPick,
}: MediaLibraryPickerProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<string>(defaultAssetType);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await listProgramMedia({
        programId,
        brandId,
        assetType: assetType || undefined,
        page: 1,
        limit: 100,
      });
      setFiles(result.files ?? []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load media.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [programId, brandId, assetType]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const searchLower = search.trim().toLowerCase();
  const visible = searchLower
    ? files.filter((f) =>
        (f.original_filename || f.filename || "").toLowerCase().includes(searchLower),
      )
    : files;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="border-b border-zinc-200 px-6 py-4">
          <DialogTitle>Pick from Media Library</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50/50 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key || "all"}
                type="button"
                onClick={() => setAssetType(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  assetType === f.key
                    ? "bg-blue-500 text-white"
                    : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {errorMessage && (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-400">Loading media…</div>
          ) : visible.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              {searchLower ? "No files match your search." : "No files in this filter yet. Upload from the Media tab."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visible.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    onPick(file);
                    onClose();
                  }}
                  className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
                >
                  <div className="relative flex h-28 w-full items-center justify-center bg-zinc-50">
                    {isImageFile(file) && file.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.original_filename}
                        className="h-full w-full object-cover"
                      />
                    ) : isImageFile(file) ? (
                      <PhotoIcon className="h-10 w-10 text-zinc-300" />
                    ) : (
                      <DocumentIcon className="h-10 w-10 text-zinc-300" />
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[11px] font-medium text-zinc-800">
                      {file.original_filename}
                    </p>
                    <p className="truncate text-[10px] text-zinc-400">
                      {file.asset_type ?? file.content_type}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
