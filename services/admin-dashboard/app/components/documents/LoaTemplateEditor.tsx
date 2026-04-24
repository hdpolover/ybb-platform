"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Heading1, Heading2, Loader2, CheckCircle2, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  listDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  generateLoa,
  type DocumentTemplate,
  type DocumentTemplatePlaceholder,
  type DocumentTemplateLayoutConfig,
} from "@/src/shared/api-client";

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

export function LoaTemplateEditor({ programId }: { programId: string }) {
  const { accessiblePrograms, adminProfile } = useAuth();
  const program = accessiblePrograms.find((p) => p.programId === programId);
  const brandId = program?.brandId ?? "";
  const userId = adminProfile?.userId ?? "";

  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [layout, setLayout] = useState<DocumentTemplateLayoutConfig>(DEFAULT_LAYOUT);
  const [templateName, setTemplateName] = useState("Letter of Acceptance");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write your LOA body here. Click placeholders on the right to insert them…" }),
    ],
    editorProps: { attributes: { class: "focus:outline-none min-h-[400px] text-sm leading-relaxed" } },
  });

  // Load existing template
  useEffect(() => {
    if (!programId) return;
    setLoading(true);
    listDocumentTemplates(programId, "letter_of_acceptance")
      .then((list) => {
        const t = list[0] ?? null;
        setTemplate(t);
        if (t) {
          setTemplateName(t.name);
          setLayout({ ...DEFAULT_LAYOUT, ...(t.layoutConfig ?? {}) });
          if (editor && t.htmlContent) {
            editor.commands.setContent(t.htmlContent, { emitUpdate: false });
          }
        }
      })
      .catch(() => toast.error("Failed to load LOA template"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  // Set content once editor is ready and template is loaded
  const contentSetRef = useRef(false);
  useEffect(() => {
    if (!editor || !template?.htmlContent || contentSetRef.current) return;
    editor.commands.setContent(template.htmlContent, { emitUpdate: false });
    contentSetRef.current = true;
  }, [editor, template]);

  const insertPlaceholder = useCallback((key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(key).run();
  }, [editor]);

  async function save(publish: boolean) {
    if (!editor) return;
    setSaving(true);
    const htmlContent = editor.getHTML();
    const body = {
      name: templateName,
      type: "letter_of_acceptance" as const,
      htmlContent,
      placeholders: PLACEHOLDER_TOKENS,
      layoutConfig: layout,
      audienceType: "all_registered",
      isActive: publish,
    };
    try {
      if (template) {
        const updated = await updateDocumentTemplate(template.id, body);
        setTemplate(updated);
        toast.success(publish ? "Template published" : "Draft saved");
      } else {
        const created = await createDocumentTemplate(programId, { ...body, userId, brandId });
        setTemplate(created);
        toast.success(publish ? "Template published" : "Draft saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateAll() {
    if (!template) { toast.error("Save the template first"); return; }
    setGenerating(true);
    try {
      const result = await generateLoa(programId, template.id, { bulk: true });
      toast.success(`Generated ${result.generated} LOA(s)${result.failed ? `, ${result.failed} failed` : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
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
            {template && ` · Last updated ${new Date(template.updatedAt).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            disabled={generating || !template}
            onClick={handleGenerateAll}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Generate All
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
        {/* Left: body editor (60%) */}
        <div className="flex w-[60%] flex-col gap-3">
          {/* Header HTML */}
          <div>
            <label className={labelCls}>Header HTML</label>
            <textarea
              rows={3}
              className={inputCls + " resize-none font-mono text-[11px]"}
              value={layout.headerHtml ?? ""}
              onChange={(e) => setLayout((l) => ({ ...l, headerHtml: e.target.value }))}
              placeholder="<div style='text-align:center'><img src='{{logo}}' style='height:60px'/><h2>YBB Foundation</h2></div>"
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

          {/* Footer HTML */}
          <div>
            <label className={labelCls}>Footer HTML</label>
            <textarea
              rows={3}
              className={inputCls + " resize-none font-mono text-[11px]"}
              value={layout.footerHtml ?? ""}
              onChange={(e) => setLayout((l) => ({ ...l, footerHtml: e.target.value }))}
              placeholder="<div style='margin-top:32px'><img src='{{signature}}' style='height:48px'/><p><strong>Program Director</strong></p></div>"
            />
          </div>
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

            <div className="mb-3">
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

            <div className="mb-3">
              <label className={labelCls}>Logo URL</label>
              <input
                className={inputCls}
                value={layout.logoUrl ?? ""}
                onChange={(e) => setLayout((l) => ({ ...l, logoUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className={labelCls}>Signature Image URL</label>
              <input
                className={inputCls}
                value={layout.signatureUrl ?? ""}
                onChange={(e) => setLayout((l) => ({ ...l, signatureUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
