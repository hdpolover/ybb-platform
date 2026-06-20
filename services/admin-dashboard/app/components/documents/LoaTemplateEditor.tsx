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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import {
  listDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  listProgramMedia,
  uploadFileViaPresignedUrl,
  type DocumentTemplate,
  type DocumentTemplatePlaceholder,
  type DocumentTemplateLayoutConfig,
  type MediaFile,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

const PLACEHOLDER_TOKENS: DocumentTemplatePlaceholder[] = [
  { key: "{{participant_name}}", label: "Participant Full Name", source: "participant.fullName" },
  { key: "{{program_name}}", label: "Program Name", source: "program.name" },
  { key: "{{acceptance_date}}", label: "Acceptance Date", source: "generated_at" },
  { key: "{{batch}}", label: "Batch / Cohort", source: "program.batch" },
  { key: "{{document_number}}", label: "Document Number", source: "participant_document.documentNumber" },
  { key: "{{participation_category}}", label: "Participation Category", source: "application.participationCategory.name" },
];

const DEFAULT_LAYOUT: DocumentTemplateLayoutConfig = {
  pageSize: "A4",
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  headerHtml: "",
  footerHtml: "",
  logoUrl: "",
  signatureUrl: "",
};

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

function ImageUploadField({
  label,
  value,
  onChange,
  programId,
  brandId,
  userId,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  programId: string;
  brandId: string;
  userId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
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
              onClick={() => onChange("")}
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

function MiniEditor({
  editor,
  tokenLabel,
  tokenKey,
  placeholder,
}: {
  editor: ReturnType<typeof useEditor> | null;
  tokenLabel: string;
  tokenKey: string;
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
      </div>
      <div className="min-h-[72px] px-4 py-3">
        {editor && <EditorContent editor={editor} />}
      </div>
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
  const [templateName, setTemplateName] = useState("Letter of Acceptance");
  const [previewMode, setPreviewMode] = useState(false);

  const editorExtensions = [
    StarterKit,
    Underline,
    TextStyle,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Link.configure({ openOnClick: false }),
  ];

  const headerEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: "Header content — use {{logo}} to insert the logo…" }),
    ],
    editorProps: { attributes: { class: "focus:outline-none text-sm leading-relaxed" } },
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...editorExtensions,
      Placeholder.configure({ placeholder: "Write your LOA body here. Click placeholders on the right to insert them…" }),
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
        if (t) {
          setTemplateName(t.name);
          const lc = { ...DEFAULT_LAYOUT, ...(t.layoutConfig ?? {}) };
          setLayout(lc);
        }
      })
      .catch(() => toast.error("Failed to load LOA template"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProgramId]);

  // Set editor content once editors + template are ready
  const contentSetRef = useRef(false);
  useEffect(() => {
    if (contentSetRef.current || !template) return;
    if (editor && template.htmlContent) {
      editor.commands.setContent(template.htmlContent, { emitUpdate: false });
    }
    if (headerEditor && template.layoutConfig?.headerHtml) {
      headerEditor.commands.setContent(template.layoutConfig.headerHtml, { emitUpdate: false });
    }
    if (footerEditor && template.layoutConfig?.footerHtml) {
      footerEditor.commands.setContent(template.layoutConfig.footerHtml, { emitUpdate: false });
    }
    if (editor && headerEditor && footerEditor) {
      contentSetRef.current = true;
    }
  }, [editor, headerEditor, footerEditor, template]);

  const insertPlaceholder = useCallback((key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(key).run();
  }, [editor]);

  async function save(publish: boolean) {
    if (!editor) return;
    setSaving(true);
    const htmlContent = editor.getHTML();
    const headerHtml = headerEditor?.getHTML() ?? layout.headerHtml ?? "";
    const footerHtml = footerEditor?.getHTML() ?? layout.footerHtml ?? "";
    const body = {
      name: templateName,
      type: "letter_of_acceptance" as const,
      htmlContent,
      placeholders: PLACEHOLDER_TOKENS,
      layoutConfig: { ...layout, headerHtml, footerHtml },
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

  function buildPreviewDoc(): string {
    const SAMPLE: Record<string, string> = {
      "{{participant_name}}": "Jane Doe",
      "{{program_name}}": program?.programName ?? "Your Program",
      "{{acceptance_date}}": formatDate(new Date(), { year: "numeric", month: "long", day: "numeric" }),
      "{{batch}}": "Batch 1",
      "{{document_number}}": "DOC-2026-001",
      "{{participation_category}}": "International Delegate",
      "{{logo}}": layout.logoUrl
        ? `<img src="${layout.logoUrl}" style="height:60px;display:block;margin:0 auto 6px" />`
        : `<div style="display:inline-block;height:60px;width:120px;background:#e5e7eb;border-radius:6px;line-height:60px;text-align:center;font-size:11px;color:#6b7280">[LOGO]</div>`,
      "{{signature}}": layout.signatureUrl
        ? `<img src="${layout.signatureUrl}" style="height:48px;display:block;margin-bottom:4px" />`
        : `<div style="display:inline-block;height:48px;width:120px;background:#e5e7eb;border-radius:4px;line-height:48px;text-align:center;font-size:11px;color:#6b7280">[SIGNATURE]</div>`,
    };

    const m = layout.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };
    let combined = [
      headerEditor?.getHTML() ?? "",
      editor?.getHTML() ?? "",
      footerEditor?.getHTML() ?? "",
    ].join("\n");

    for (const [key, val] of Object.entries(SAMPLE)) {
      combined = combined.split(key).join(val);
    }

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,serif;font-size:12pt;line-height:1.7;color:#111;
       padding:${m.top}pt ${m.right}pt ${m.bottom}pt ${m.left}pt;background:#fff}
  h1{font-size:20pt;margin-bottom:10pt;font-weight:700}
  h2{font-size:15pt;margin-bottom:8pt;font-weight:600}
  h3{font-size:13pt;margin-bottom:6pt;font-weight:600}
  p{margin-bottom:9pt}
  ul,ol{margin:0 0 9pt 18pt}
  li{margin-bottom:3pt}
  strong{font-weight:700}
  em{font-style:italic}
  u{text-decoration:underline}
  img{max-width:100%}
  [style*="text-align:center"],[style*="text-align: center"]{text-align:center}
  [style*="text-align:right"],[style*="text-align: right"]{text-align:right}
</style>
</head><body>${combined}</body></html>`;
  }

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
          <h1 className="text-lg font-semibold text-zinc-900">LOA Template Editor</h1>
          <p className="text-xs text-zinc-500">
            {template ? (template.isActive ? "Published" : "Draft") : "No template yet"}
            {template && ` · Last updated ${formatDate(template.updatedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode((p) => !p)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewMode ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
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
          placeholder="Letter of Acceptance"
        />
      </div>

      {/* Two-column editor */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: editors or preview (60%) */}
        <div className="flex w-[60%] flex-col gap-3 overflow-y-auto">
          {previewMode ? (
            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-inner" style={{ minHeight: 600 }}>
              <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-500">
                <Eye className="h-3 w-3" />
                Preview — sample data substituted
              </div>
              <iframe
                srcDoc={buildPreviewDoc()}
                sandbox="allow-same-origin"
                className="h-full w-full flex-1"
                title="LOA Preview"
                style={{ minHeight: 560 }}
              />
            </div>
          ) : (
            <>
              {/* Header editor */}
              <div>
                <label className={labelCls}>Header</label>
                <MiniEditor
                  editor={headerEditor}
                  tokenLabel="Logo"
                  tokenKey="{{logo}}"
                  placeholder="Header content — use {{logo}} to insert the logo…"
                />
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

            <div>
              <ImageUploadField
                label="Signature Image"
                value={layout.signatureUrl ?? ""}
                onChange={(url) => setLayout((l) => ({ ...l, signatureUrl: url }))}
                programId={resolvedProgramId}
                brandId={brandId}
                userId={userId}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
