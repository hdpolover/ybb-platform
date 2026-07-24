"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Undo, Redo, RemoveFormatting,
  Heading1, Heading2, Loader2, CheckCircle2, Upload, ImageIcon, X, Eye, EyeOff,
  ChevronDown, Pencil, AlertTriangle, RefreshCw, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { ConfirmDialog } from "@/src/admin/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/ui/dropdown-menu";
import {
  listDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  previewDocumentTemplate,
  listProgramMedia,
  uploadFileViaPresignedUrl,
  listSignatures,
  createSignature,
  updateSignature,
  deleteSignature,
  type DocumentTemplate,
  type DocumentTemplatePlaceholder,
  type DocumentTemplateLayoutConfig,
  type MediaFile,
  type Signature,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";
import { LoaParticipantPicker } from "./LoaParticipantPicker";

const PLACEHOLDER_TOKENS: DocumentTemplatePlaceholder[] = [
  { key: "{{participant_name}}", label: "Participant Full Name", source: "participant.fullName" },
  { key: "{{program_name}}", label: "Program Name", source: "program.name" },
  { key: "{{acceptance_date}}", label: "Acceptance Date", source: "generated_at" },
  { key: "{{batch}}", label: "Batch / Cohort", source: "program.batch" },
  { key: "{{document_number}}", label: "Document Number", source: "participant_document.documentNumber" },
  { key: "{{participation_category}}", label: "Participation Category", source: "application.participationCategory.name" },
  { key: "{{program_location}}", label: "Program Location", source: "program.location" },
  { key: "{{start_date}}", label: "Start Date", source: "program.startDate" },
  { key: "{{end_date}}", label: "End Date", source: "program.endDate" },
  { key: "{{institution}}", label: "Institution", source: "participant.institution" },
  { key: "{{nationality}}", label: "Nationality", source: "participant.nationality" },
  { key: "{{date_of_birth}}", label: "Date of Birth", source: "participant.birthdate" },
  { key: "{{gender}}", label: "Gender", source: "participant.gender" },
  { key: "{{country_of_origin}}", label: "Country of Origin", source: "participant.originCountry" },
  { key: "{{signer_name}}", label: "Signer Name", source: "signer_name" },
  { key: "{{signer_title}}", label: "Signer Title", source: "signer_title" },
  { key: "{{program_year}}", label: "Program Year", source: "program.year" },
  { key: "{{participant_email}}", label: "Participant Email", source: "participant.email" },
  { key: "{{participant_phone}}", label: "Participant Phone", source: "participant.phone" },
  { key: "{{major}}", label: "Major", source: "participant.major" },
  { key: "{{occupation}}", label: "Occupation", source: "participant.occupation" },
  { key: "{{program_theme}}", label: "Program Theme", source: "program.theme" },
  { key: "{{brand_name}}", label: "Brand Name", source: "brand.name" },
];

const DEFAULT_LAYOUT: DocumentTemplateLayoutConfig = {
  pageSize: "A4",
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  headerHtml: "",
  footerHtml: "",
  logoUrl: "",
  signatureUrl: "",
};

/** True when `html` has visible content — not just empty Tiptap `<p></p>` shells. */
function hasMeaningfulHtml(html?: string): boolean {
  if (!html) return false;
  const stripped = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
  return stripped.length > 0 || /<img\b/i.test(html);
}

function ToolbarBtn({
  onClick, active, title, disabled, children,
}: {
  onClick: () => void; active?: boolean; title?: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={[
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active ? "bg-blue-100 text-blue-700" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        disabled ? "pointer-events-none opacity-30" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="mx-0.5 h-5 w-px bg-zinc-200" />;
}

const inputCls =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const labelCls = "block text-[11px] font-medium text-zinc-500 mb-1";

// ─── Image Upload Field ───────────────────────────────────────────────────────

interface StampImageWarnings {
  wideAspectRatio: boolean;
  noTransparency: boolean;
}

/**
 * Advisory-only checks for a stamp image, run against the raw File the admin
 * just picked (before upload finishes) via an object URL — local blob reads
 * never taint the canvas, so this is safe without touching CORS at all.
 * Samples a 3x3 grid (corners, edge midpoints, center) rather than scanning
 * every pixel, which is plenty to tell "has a transparent background" from
 * "fully opaque" without cost scaling with image size.
 */
async function analyzeStampImage(file: File): Promise<StampImageWarnings | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image"));
      el.src = objectUrl;
    });

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;

    const wideAspectRatio = w / h >= 2 || h / w >= 2;

    let noTransparency = false;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const xs = [0, Math.floor((w - 1) / 2), w - 1];
        const ys = [0, Math.floor((h - 1) / 2), h - 1];
        noTransparency = true;
        outer: for (const x of xs) {
          for (const y of ys) {
            const alpha = ctx.getImageData(x, y, 1, 1).data[3];
            if (alpha < 250) {
              noTransparency = false;
              break outer;
            }
          }
        }
      }
    } catch {
      // Advisory only — if the canvas read fails for any reason, skip the
      // transparency warning rather than risk blocking the upload flow.
      noTransparency = false;
    }

    return { wideAspectRatio, noTransparency };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function ImageUploadField({
  label,
  value,
  onChange,
  programId,
  brandId,
  userId,
  stampWarnings = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  programId: string;
  brandId: string;
  userId: string;
  /** Enables the stamp-specific advisory checks (aspect ratio, transparency). */
  stampWarnings?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [imageWarnings, setImageWarnings] = useState<StampImageWarnings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    if (stampWarnings) {
      // Fire-and-forget: reflects the file the admin actually chose, but
      // never gates the upload — it's advisory only.
      setImageWarnings(null);
      analyzeStampImage(file)
        .then(setImageWarnings)
        .catch(() => setImageWarnings(null));
    }
    try {
      const result = await uploadFileViaPresignedUrl(file, {
        userId,
        brandId,
        programId,
        bucket: "documents",
        assetType: "image",
      });
      if (result.publicUrl) onChange(result.publicUrl);
      else toast.error("Upload succeeded but no URL returned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function openMediaLibrary() {
    setMediaOpen(true);
    setMediaLoading(true);
    try {
      const result = await listProgramMedia({ programId, brandId, limit: 50 });
      setMediaFiles(result.files.filter((f) => f.content_type.startsWith("image/")));
    } catch {
      toast.error("Failed to load media library");
    } finally {
      setMediaLoading(false);
    }
  }

  return (
    <>
      <div>
        <label className={labelCls}>{label}</label>
        {value ? (
          <div className="relative mb-2 flex h-16 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-auto max-w-full object-contain p-1" />
            <button
              type="button"
              title="Remove"
              onClick={() => { setImageWarnings(null); onChange(""); }}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-zinc-400 shadow ring-1 ring-zinc-200 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </button>
          <button
            type="button"
            onClick={openMediaLibrary}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <ImageIcon className="h-3 w-3" />
            Media Library
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {stampWarnings && imageWarnings && (imageWarnings.wideAspectRatio || imageWarnings.noTransparency) ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1 space-y-1">
                {imageWarnings.wideAspectRatio ? (
                  <p className="text-[10px] text-amber-700">
                    This looks like a wide logo, not a stamp. Stamps look best roughly square.
                  </p>
                ) : null}
                {imageWarnings.noTransparency ? (
                  <p className="text-[10px] text-amber-700">
                    A transparent PNG will layer more cleanly over the letter than one with a solid background.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Media Library</DialogTitle>
          </DialogHeader>
          {mediaLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : mediaFiles.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-400">No images found in media library.</p>
          ) : (
            <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
              {mediaFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { onChange(f.url ?? f.download_url ?? ""); setMediaOpen(false); }}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:border-blue-400"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url ?? f.download_url ?? ""}
                    alt={f.alt_text ?? f.original_filename}
                    className="h-full w-full object-contain p-1"
                  />
                  <div className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100">
                    {f.original_filename}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Mini Section Editor (header / footer) ────────────────────────────────────

/** Dropdown listing every token in `tokens`, inserting the selected one at the cursor. */
function TokenInsertMenu({
  editor,
  tokens,
}: {
  editor: ReturnType<typeof useEditor> | null;
  tokens: DocumentTemplatePlaceholder[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Insert token"
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Tokens
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-64 overflow-y-auto">
        {tokens.map((t) => (
          <DropdownMenuItem
            key={t.key}
            onSelect={() => editor?.chain().focus().insertContent(t.key).run()}
            className="flex flex-col items-start gap-0"
          >
            <span className="text-xs text-zinc-700">{t.label}</span>
            <code className="text-[10px] font-mono text-blue-600">{t.key}</code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MiniEditor({
  editor,
  tokenLabel,
  tokenKey,
  allTokens,
  placeholder,
}: {
  editor: ReturnType<typeof useEditor> | null;
  tokenLabel: string;
  tokenKey: string;
  allTokens: DocumentTemplatePlaceholder[];
  placeholder?: string;
}) {
  void placeholder;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-2 py-1">
        <ToolbarBtn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-3 w-3" />
        </ToolbarBtn>
        <ToolbarBtn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-3 w-3" />
        </ToolbarBtn>
        <ToolbarBtn title="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-3 w-3" />
        </ToolbarBtn>
        <Sep />
        <ToolbarBtn title="Align Left" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-3 w-3" />
        </ToolbarBtn>
        <ToolbarBtn title="Align Center" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-3 w-3" />
        </ToolbarBtn>
        <ToolbarBtn title="Align Right" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-3 w-3" />
        </ToolbarBtn>
        <Sep />
        <button
          type="button"
          title={`Insert ${tokenLabel}`}
          onMouseDown={(e) => { e.preventDefault(); editor?.chain().focus().insertContent(tokenKey).run(); }}
          className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] text-blue-700 hover:bg-blue-100"
        >
          {tokenKey}
        </button>
        <TokenInsertMenu editor={editor} tokens={allTokens} />
      </div>
      <div className="min-h-[72px] px-4 py-3">
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  );
}

// ─── Preview Pane ─────────────────────────────────────────────────────────────

interface PreviewPaneProps {
  label: string;
  loading: boolean;
  error: string | null;
  pdfUrl: string | null;
  onRegenerate: () => void;
  warning?: string | null;
}

function PreviewPane({ label, loading, error, pdfUrl, onRegenerate, warning }: PreviewPaneProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-inner" style={{ minHeight: 560 }}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5 font-medium text-zinc-700">
          <Eye className="h-3 w-3" />
          {label}
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={onRegenerate}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
      {warning ? (
        <div className="flex items-start gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <p className="text-[10px] text-amber-700">{warning}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Rendering PDF…
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-xs font-medium text-red-600">Preview failed</p>
          <p className="max-w-sm text-[11px] text-zinc-500">{error}</p>
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Try again
          </button>
        </div>
      ) : pdfUrl ? (
        <iframe src={pdfUrl} className="h-full w-full flex-1" title={`Invitation Letter Preview - ${label}`} style={{ minHeight: 520 }} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-400">No preview yet.</div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LoaTemplateEditorProps {
  programId: string;
  onTemplateChange?: (template: DocumentTemplate | null) => void;
}

export function LoaTemplateEditor({ programId, onTemplateChange }: LoaTemplateEditorProps) {
  const resolvedProgramId = useResolvedProgramId(programId);
  const { accessiblePrograms, adminProfile } = useAuth();
  const program = accessiblePrograms.find(
    (p) => p.programId === programId || p.programSlug === programId,
  );
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";

  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState<DocumentTemplateLayoutConfig>(DEFAULT_LAYOUT);
  const [templateName, setTemplateName] = useState("Invitation Letter");
  const [previewMode, setPreviewMode] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);

  // Structured letterhead migration gate (Task 3): true once it's safe to edit
  // the Tagline/Website/Email/Phone fields — either the template already has a
  // `header` struct, it never had legacy headerHtml, or the admin explicitly
  // confirmed switching away from the legacy freeform HTML. Starts true (no
  // legacy content assumed) and gets corrected downward once the template loads.
  const [structuredHeaderConfirmed, setStructuredHeaderConfirmed] = useState(true);

  // Real-renderer preview: the PDF blob URLs from the file-service WeasyPrint
  // pipeline, not a hand-rolled HTML mock. Two panes - DRAFT (unsaved editor
  // state) and SAVED (persisted template row) - rendered side by side so a
  // corrupted persisted template can never hide behind a perfect-looking
  // draft again.
  const [previewPdfUrls, setPreviewPdfUrls] = useState<{ draft: string | null; saved: string | null }>({
    draft: null,
    saved: null,
  });
  const [previewLoading, setPreviewLoading] = useState<{ draft: boolean; saved: boolean }>({
    draft: false,
    saved: false,
  });
  const [previewErrors, setPreviewErrors] = useState<{ draft: string | null; saved: string | null }>({
    draft: null,
    saved: null,
  });
  const previewObjectUrlRefs = useRef<{ draft: string | null; saved: string | null }>({ draft: null, saved: null });

  // Who the preview is rendered as. Resolved server-side (auto-pick or the
  // admin's explicit picker choice) and reported back via response headers,
  // since the endpoint returns a raw PDF blob with no JSON body.
  const [previewApplicationId, setPreviewApplicationId] = useState<string | null>(null);
  const [previewParticipantName, setPreviewParticipantName] = useState<string | null>(null);
  const [previewIsSample, setPreviewIsSample] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Signatures (brand-scoped, reusable across templates)
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(false);
  const [signatureFormOpen, setSignatureFormOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState<Signature | null>(null);
  const [sigFormName, setSigFormName] = useState("");
  const [sigFormTitle, setSigFormTitle] = useState("");
  const [sigFormImageUrl, setSigFormImageUrl] = useState("");
  const [sigFormSaving, setSigFormSaving] = useState(false);

  const editorExtensions = [
    StarterKit,
    Underline,
    TextStyle,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Link.configure({ openOnClick: false }),
  ];

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: "Write your Invitation Letter body here. Click placeholders on the right to insert them…" }),
    ],
    editorProps: { attributes: { class: "focus:outline-none min-h-[400px] text-sm leading-relaxed" } },
  });

  const footerEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: "Footer content — use {{signature}} to insert the signature image…" }),
    ],
    editorProps: { attributes: { class: "focus:outline-none text-sm leading-relaxed" } },
  });

  // Load existing template
  useEffect(() => {
    if (!resolvedProgramId) return;
    setLoading(true);
    listDocumentTemplates(resolvedProgramId, "letter_of_acceptance")
      .then((list) => {
        const t = list[0] ?? null;
        setTemplate(t);
        onTemplateChange?.(t);
        if (t) {
          setTemplateName(t.name);
          const lc = { ...DEFAULT_LAYOUT, ...(t.layoutConfig ?? {}) };
          setLayout(lc);
          // Legacy gate: only block editing the structured fields when this
          // template has real freeform header HTML AND no `header` struct yet —
          // that's the exact condition under which touching Tagline/Website/
          // Email/Phone would silently orphan the old HTML (see Task 3 brief).
          const hasStructured = Boolean(lc.header);
          const hasLegacyHtml = hasMeaningfulHtml(lc.headerHtml);
          setStructuredHeaderConfirmed(hasStructured || !hasLegacyHtml);
        } else {
          setStructuredHeaderConfirmed(true);
        }
      })
      .catch(() => toast.error("Failed to load Invitation Letter template"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProgramId]);

  const refreshSignatures = useCallback(() => {
    if (!brandId) return;
    setSignaturesLoading(true);
    listSignatures(brandId)
      .then(setSignatures)
      .catch(() => toast.error("Failed to load signatures"))
      .finally(() => setSignaturesLoading(false));
  }, [brandId]);

  useEffect(() => {
    refreshSignatures();
  }, [refreshSignatures]);

  function openCreateSignature() {
    setEditingSignature(null);
    setSigFormName("");
    setSigFormTitle("");
    setSigFormImageUrl("");
    setSignatureFormOpen(true);
  }

  function openEditSignature(sig: Signature) {
    setEditingSignature(sig);
    setSigFormName(sig.name);
    setSigFormTitle(sig.title ?? "");
    setSigFormImageUrl(sig.imageUrl);
    setSignatureFormOpen(true);
  }

  async function saveSignatureForm() {
    if (!sigFormName.trim()) {
      toast.error("Signature name is required");
      return;
    }
    if (!sigFormImageUrl) {
      toast.error("Signature image is required");
      return;
    }
    setSigFormSaving(true);
    try {
      if (editingSignature) {
        await updateSignature(editingSignature.id, {
          name: sigFormName.trim(),
          title: sigFormTitle.trim() || undefined,
          imageUrl: sigFormImageUrl,
        });
        toast.success("Signature updated");
      } else {
        await createSignature({
          brandId,
          name: sigFormName.trim(),
          title: sigFormTitle.trim() || undefined,
          imageUrl: sigFormImageUrl,
        });
        toast.success("Signature created");
      }
      setSignatureFormOpen(false);
      refreshSignatures();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save signature");
    } finally {
      setSigFormSaving(false);
    }
  }

  async function removeSignature(sig: Signature) {
    if (!window.confirm(`Delete signature "${sig.name}"? This cannot be undone.`)) return;
    try {
      await deleteSignature(sig.id);
      if (layout.signatureId === sig.id) {
        setLayout((l) => ({ ...l, signatureId: undefined }));
      }
      toast.success("Signature deleted");
      refreshSignatures();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete signature");
    }
  }

  // Set editor content once editors + template are ready
  const contentSetRef = useRef(false);
  useEffect(() => {
    if (contentSetRef.current || !template) return;
    if (editor && template.htmlContent) {
      editor.commands.setContent(template.htmlContent, { emitUpdate: false });
    }
    if (footerEditor && template.layoutConfig?.footerHtml) {
      footerEditor.commands.setContent(template.layoutConfig.footerHtml, { emitUpdate: false });
    }
    if (editor && footerEditor) {
      contentSetRef.current = true;
    }
  }, [editor, footerEditor, template]);

  // Revoke both preview panes' blob URLs on unmount / before generating new ones.
  useEffect(() => {
    return () => {
      const urls = previewObjectUrlRefs.current;
      if (urls.draft) URL.revokeObjectURL(urls.draft);
      if (urls.saved) URL.revokeObjectURL(urls.saved);
    };
  }, []);

  const insertPlaceholder = useCallback((key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(key).run();
  }, [editor]);

  async function save(publish: boolean) {
    if (!editor) return;
    setSaving(true);
    const htmlContent = editor.getHTML();
    // headerHtml is no longer editable in this UI (Task 3) — whatever value
    // `layout.headerHtml` already holds (legacy content, or nothing) is
    // preserved untouched. It only stops being *used* by the renderer once
    // `layout.header` is set — see the legacy-header switch action below.
    const footerHtml = footerEditor?.getHTML() ?? layout.footerHtml ?? "";
    const body = {
      name: templateName,
      type: "letter_of_acceptance" as const,
      htmlContent,
      placeholders: PLACEHOLDER_TOKENS,
      layoutConfig: { ...layout, footerHtml },
      audienceType: "all_registered",
      isActive: publish,
    };
    try {
      if (template) {
        const updated = await updateDocumentTemplate(template.id, body);
        setTemplate(updated);
        onTemplateChange?.(updated);
        toast.success(publish ? "Template published" : "Draft saved");
      } else {
        const created = await createDocumentTemplate(resolvedProgramId, { ...body, userId, brandId });
        setTemplate(created);
        onTemplateChange?.(created);
        toast.success(publish ? "Template published" : "Draft saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Renders through the same file-service WeasyPrint pipeline (structured
  // header, footer precedence, auto-stamp, page-footer disclaimer) that
  // LoaDownloadService uses for real participant downloads - see
  // PreviewLoaTemplateHandler on the API side. No hand-rolled HTML mock.
  // `applicationIdOverride` lets a caller that just changed
  // `previewApplicationId` (via setState, which doesn't take effect until the
  // next render) pass the new id straight through instead of reading the
  // stale value still captured in this callback's closure. `undefined` means
  // "no override, use current state" - `null` is a valid override meaning
  // "let the backend auto-pick," so it can't double as "no override."
  const generatePreview = useCallback(async (source: "draft" | "saved", applicationIdOverride?: string | null) => {
    if (!editor || !resolvedProgramId) return;
    setPreviewLoading((l) => ({ ...l, [source]: true }));
    setPreviewErrors((e) => ({ ...e, [source]: null }));
    try {
      const footerHtml = footerEditor?.getHTML() ?? layout.footerHtml ?? "";
      const effectiveApplicationId = applicationIdOverride !== undefined ? applicationIdOverride : previewApplicationId;
      const result = await previewDocumentTemplate(resolvedProgramId, {
        htmlContent: editor.getHTML(),
        placeholders: PLACEHOLDER_TOKENS,
        layoutConfig: { ...layout, footerHtml },
        applicationId: effectiveApplicationId ?? undefined,
        source,
      });
      const prevUrl = previewObjectUrlRefs.current[source];
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      const url = URL.createObjectURL(result.blob);
      previewObjectUrlRefs.current[source] = url;
      setPreviewPdfUrls((u) => ({ ...u, [source]: url }));
      // The draft pane's response is treated as authoritative for the shared
      // "Previewing as" header - both panes resolve to the same application
      // in practice, since they're issued with the same applicationId/program.
      if (source === "draft") {
        setPreviewParticipantName(result.participantName);
        setPreviewIsSample(result.isSample);
      }
    } catch (err) {
      setPreviewErrors((e) => ({ ...e, [source]: err instanceof Error ? err.message : "Failed to generate preview" }));
    } finally {
      setPreviewLoading((l) => ({ ...l, [source]: false }));
    }
  }, [editor, footerEditor, layout, resolvedProgramId, previewApplicationId]);

  const generateBothPreviews = useCallback((applicationIdOverride?: string | null) => {
    void generatePreview("draft", applicationIdOverride);
    void generatePreview("saved", applicationIdOverride);
  }, [generatePreview]);

  function togglePreview() {
    const next = !previewMode;
    setPreviewMode(next);
    if (next) generateBothPreviews();
  }

  function handlePickerSelect(applicationId: string, participantName: string) {
    setPreviewApplicationId(applicationId);
    setPreviewParticipantName(participantName);
    setPreviewIsSample(false);
    generateBothPreviews(applicationId);
  }

  // Plain computation, not useMemo - Tiptap's `editor` object reference stays
  // stable across keystrokes, so a useMemo keyed on [editor] would never
  // recompute. This component already re-renders on every keystroke via
  // Tiptap's own transaction-triggered updates, so a cheap inline
  // computation is correct here and costs no server work.
  const currentFooterHtml = footerEditor?.getHTML() ?? layout.footerHtml ?? "";
  const hasDraftDrift = Boolean(
    template &&
      (editor?.getHTML() !== (template.htmlContent ?? "") ||
        JSON.stringify({ ...layout, footerHtml: currentFooterHtml }) !==
          JSON.stringify({ ...DEFAULT_LAYOUT, ...(template.layoutConfig ?? {}) })),
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Invitation Letter Template Editor</h1>
          <p className="text-xs text-zinc-500">
            {template ? (template.isActive ? "Published" : "Draft") : "No template yet"}
            {template && ` · Last updated ${formatDate(template.updatedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePreview}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewMode ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (template?.isActive) {
                setUnpublishConfirmOpen(true);
              } else {
                save(false);
              }
            }}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Publish
          </button>
        </div>
      </div>

      {/* Template name */}
      <div className="w-80">
        <label className={labelCls}>Template Name</label>
        <input
          className={inputCls}
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Invitation Letter"
        />
      </div>

      {/* Two-column editor */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: editors or preview (60%) */}
        <div className="flex w-[60%] flex-col gap-3 overflow-y-auto">
          {previewMode ? (
            <div className="flex flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <UserRound className="h-3.5 w-3.5 text-zinc-400" />
                  {previewIsSample ? (
                    <span>
                      Showing <span className="font-medium text-amber-700">sample data</span> - no submitted or
                      accepted applications yet for this program.
                    </span>
                  ) : (
                    <span>
                      Previewing as: <span className="font-medium text-zinc-900">{previewParticipantName ?? "…"}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  [change]
                </button>
              </div>
              <div className="flex flex-1 gap-2 overflow-hidden">
                <PreviewPane
                  label="DRAFT"
                  loading={previewLoading.draft}
                  error={previewErrors.draft}
                  pdfUrl={previewPdfUrls.draft}
                  onRegenerate={() => void generatePreview("draft")}
                  warning={
                    hasDraftDrift
                      ? "This draft differs from the last saved template. SAVED still reflects what participants can download today."
                      : null
                  }
                />
                <PreviewPane
                  label="SAVED"
                  loading={previewLoading.saved}
                  error={previewErrors.saved}
                  pdfUrl={previewPdfUrls.saved}
                  onRegenerate={() => void generatePreview("saved")}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Header — structured letterhead only; see sidebar "Letterhead Details" */}
              <div>
                <label className={labelCls}>Header</label>
                {structuredHeaderConfirmed ? (
                  <p className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
                    Built from the Logo and Letterhead Details fields in the sidebar — there is no freeform header editor.
                  </p>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-amber-800">Legacy freeform header</p>
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          This template&apos;s letterhead still comes from old freeform HTML, shown read-only below. The
                          freeform header editor has been removed — switch to the structured Logo + Letterhead Details
                          fields in the sidebar to keep editing it. Switching stops using this HTML permanently.
                        </p>
                        <div
                          className="mt-2 max-h-32 overflow-y-auto rounded border border-amber-200 bg-white px-3 py-2 text-xs text-zinc-700"
                          // Read-only render of admin-authored HTML already stored on this template —
                          // same trust boundary Tiptap's setContent() rendered it under before.
                          dangerouslySetInnerHTML={{ __html: layout.headerHtml || "" }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Switch to the structured letterhead fields? The old HTML header will no longer be used.",
                              )
                            ) {
                              setLayout((l) => ({
                                ...l,
                                header: l.header ?? { tagline: "", website: "", email: "", phone: "" },
                              }));
                              setStructuredHeaderConfirmed(true);
                            }
                          }}
                          className="mt-2 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Switch to structured letterhead fields
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Body editor */}
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 bg-white">
                <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-2 py-1.5">
                  <ToolbarBtn title="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
                    <Undo className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
                    <Redo className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <Sep />
                  <ToolbarBtn title="H1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                    <Heading1 className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <Heading2 className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <Sep />
                  <ToolbarBtn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
                    <Bold className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                    <Italic className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <Sep />
                  <ToolbarBtn title="Align Left" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
                    <AlignLeft className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Align Center" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
                    <AlignCenter className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Align Right" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
                    <AlignRight className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <Sep />
                  <ToolbarBtn title="Bullet List" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                    <List className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn title="Numbered List" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                    <ListOrdered className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <Sep />
                  <ToolbarBtn title="Clear Formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}>
                    <RemoveFormatting className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {editor && <EditorContent editor={editor} />}
                </div>
              </div>

              {/* Footer editor */}
              <div>
                <label className={labelCls}>Footer</label>
                <MiniEditor
                  editor={footerEditor}
                  tokenLabel="Signature"
                  tokenKey="{{signature}}"
                  allTokens={PLACEHOLDER_TOKENS}
                  placeholder="Footer content — use {{signature}} to insert the signature image…"
                />
              </div>
            </>
          )}
        </div>

        {/* Right: sidebar (40%) */}
        <div className="flex w-[40%] flex-col gap-4 overflow-y-auto">
          {/* Placeholders */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="mb-1 text-xs font-semibold text-zinc-800">Placeholder Tokens</h3>
            <p className="mb-3 text-[11px] text-zinc-500">Click to insert at cursor position</p>
            <div className="flex flex-col gap-1.5">
              {PLACEHOLDER_TOKENS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key)}
                  className="flex items-center justify-between rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="text-[11px] text-zinc-600">{p.label}</span>
                  <code className="ml-2 shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-mono text-blue-700">
                    {p.key}
                  </code>
                </button>
              ))}
            </div>
          </div>

          {/* Layout config */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold text-zinc-800">Layout Settings</h3>

            <div className="mb-3">
              <label className={labelCls}>Page Size</label>
              <select
                className={inputCls}
                value={layout.pageSize ?? "A4"}
                onChange={(e) => setLayout((l) => ({ ...l, pageSize: e.target.value }))}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </div>

            <div className="mb-4">
              <label className={labelCls}>Margins (pt)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["top", "right", "bottom", "left"] as const).map((side) => (
                  <div key={side}>
                    <span className="block text-center text-[10px] text-zinc-400 mb-0.5 capitalize">{side}</span>
                    <input
                      type="number"
                      min={0}
                      className={inputCls + " text-center"}
                      value={layout.margins?.[side] ?? 40}
                      onChange={(e) =>
                        setLayout((l) => ({
                          ...l,
                          margins: { ...(l.margins ?? { top: 40, right: 40, bottom: 40, left: 40 }), [side]: Number(e.target.value) },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <ImageUploadField
                label="Logo"
                value={layout.logoUrl ?? ""}
                onChange={(url) => setLayout((l) => ({ ...l, logoUrl: url }))}
                programId={resolvedProgramId}
                brandId={brandId}
                userId={userId}
              />
            </div>

            <div className="mb-1">
              <span className={labelCls}>Letterhead Details</span>
              <p className="mb-2 text-[10px] text-zinc-400">
                Program name and batch render automatically — these fill the tagline/contact row next to the logo.
              </p>
              {!structuredHeaderConfirmed ? (
                <p className="mb-2 text-[10px] font-medium text-amber-600">
                  Disabled until you switch away from the legacy freeform header — see the notice above the body editor.
                </p>
              ) : null}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Tagline</label>
                <input
                  className={inputCls + " disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"}
                  disabled={!structuredHeaderConfirmed}
                  value={layout.header?.tagline ?? ""}
                  onChange={(e) =>
                    setLayout((l) => ({ ...l, header: { ...(l.header ?? {}), tagline: e.target.value } }))
                  }
                  placeholder="e.g. Empowering Youth Leaders"
                />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  className={inputCls + " disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"}
                  disabled={!structuredHeaderConfirmed}
                  value={layout.header?.website ?? ""}
                  onChange={(e) =>
                    setLayout((l) => ({ ...l, header: { ...(l.header ?? {}), website: e.target.value } }))
                  }
                  placeholder="ybb.foundation"
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  className={inputCls + " disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"}
                  disabled={!structuredHeaderConfirmed}
                  value={layout.header?.email ?? ""}
                  onChange={(e) =>
                    setLayout((l) => ({ ...l, header: { ...(l.header ?? {}), email: e.target.value } }))
                  }
                  placeholder="info@ybb.foundation"
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  className={inputCls + " disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"}
                  disabled={!structuredHeaderConfirmed}
                  value={layout.header?.phone ?? ""}
                  onChange={(e) =>
                    setLayout((l) => ({ ...l, header: { ...(l.header ?? {}), phone: e.target.value } }))
                  }
                  placeholder="+62 21 000 0000"
                />
              </div>
            </div>

            <div className="mb-4">
              <ImageUploadField
                label="Stamp"
                value={layout.stampUrl ?? ""}
                onChange={(url) => setLayout((l) => ({ ...l, stampUrl: url }))}
                programId={resolvedProgramId}
                brandId={brandId}
                userId={userId}
                stampWarnings
              />
              <p className="mt-1 text-[10px] text-zinc-400">
                Placed below the signature automatically, unless you insert a {"{{stamp}}"} token in the footer text.
              </p>
            </div>

            <div className="mb-4">
              <label className={labelCls}>Page Footer Disclaimer</label>
              <input
                className={inputCls}
                value={layout.footerNote ?? ""}
                onChange={(e) => setLayout((l) => ({ ...l, footerNote: e.target.value }))}
                placeholder="This document is computer-generated. No physical signature required."
              />
              <p className="mt-1 text-[10px] text-zinc-400">
                Pinned to the bottom of every page — separate from the sign-off block in the Footer editor below.
              </p>

              <label className="mt-3 flex items-start gap-2 text-[11px] text-zinc-600">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  checked={Boolean(layout.showGeneratedDate)}
                  onChange={(e) => setLayout((l) => ({ ...l, showGeneratedDate: e.target.checked }))}
                />
                <span>
                  Show generation date
                  <span className="block text-[10px] text-zinc-400">
                    Appends &quot;{"{Program}"} • Generated on {"{date}"}&quot; to the disclaimer above.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <ImageUploadField
                label="Legacy signature image (fallback — used only when no signature is selected below)"
                value={layout.signatureUrl ?? ""}
                onChange={(url) => setLayout((l) => ({ ...l, signatureUrl: url }))}
                programId={resolvedProgramId}
                brandId={brandId}
                userId={userId}
              />
            </div>
          </div>

          {/* Signature picker */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-800">Signature</h3>
              <button
                type="button"
                onClick={openCreateSignature}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                + New
              </button>
            </div>
            <p className="mb-3 text-[11px] text-zinc-500">
              Signer name and title render under the signature image automatically.
            </p>

            {signaturesLoading ? (
              <div className="flex h-16 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            ) : signatures.length === 0 ? (
              <p className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-4 text-center text-[11px] text-zinc-400">
                No signatures yet for this brand. Add one to select it here.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setLayout((l) => ({ ...l, signatureId: undefined }))}
                  className={[
                    "rounded-md border px-3 py-2 text-left text-[11px] transition",
                    !layout.signatureId
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-blue-200 hover:bg-blue-50",
                  ].join(" ")}
                >
                  None (use legacy signature image)
                </button>
                {signatures.map((sig) => (
                  <div
                    key={sig.id}
                    className={[
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 transition",
                      layout.signatureId === sig.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-zinc-100 bg-zinc-50 hover:border-blue-200",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => setLayout((l) => ({ ...l, signatureId: sig.id }))}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <div className="flex h-8 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sig.imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
                      </div>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-medium text-zinc-700">{sig.name}</span>
                        {sig.title ? (
                          <span className="block truncate text-[10px] text-zinc-400">{sig.title}</span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Edit signature"
                      onClick={() => openEditSignature(sig)}
                      className="shrink-0 text-zinc-400 hover:text-blue-600"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete signature"
                      onClick={() => removeSignature(sig)}
                      className="shrink-0 text-zinc-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature create/edit modal */}
      <Dialog open={signatureFormOpen} onOpenChange={setSignatureFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSignature ? "Edit Signature" : "New Signature"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input
                className={inputCls}
                value={sigFormName}
                onChange={(e) => setSigFormName(e.target.value)}
                placeholder="e.g. Dr. Jane Doe"
              />
            </div>
            <div>
              <label className={labelCls}>Title (optional)</label>
              <input
                className={inputCls}
                value={sigFormTitle}
                onChange={(e) => setSigFormTitle(e.target.value)}
                placeholder="e.g. Program Director"
              />
            </div>
            <ImageUploadField
              label="Signature Image"
              value={sigFormImageUrl}
              onChange={setSigFormImageUrl}
              programId={resolvedProgramId}
              brandId={brandId}
              userId={userId}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSignatureFormOpen(false)}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sigFormSaving}
                onClick={saveSignatureForm}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sigFormSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {editingSignature ? "Save Changes" : "Create Signature"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm unpublish (Save Draft on a currently-published template) */}
      <ConfirmDialog
        open={unpublishConfirmOpen}
        onOpenChange={setUnpublishConfirmOpen}
        title="Unpublish this template?"
        description="This unpublishes the Invitation Letter and participants will lose access to download it, even from batches already released. Continue?"
        confirmLabel="Unpublish"
        cancelLabel="Keep Published"
        variant="destructive"
        onConfirm={async () => {
          await save(false);
          setUnpublishConfirmOpen(false);
        }}
      />

      <LoaParticipantPicker
        programId={resolvedProgramId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
