"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Link as LinkIcon,
  ImageIcon,
  Upload,
  Paperclip,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
  RemoveFormatting,
} from "lucide-react";

interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  className?: string;
  onUploadImage?: (file: File) => Promise<string>;
  onUploadFile?: (file: File) => Promise<{ url: string; name?: string }>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ToolbarButton({
  onClick,
  active,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={[
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-blue-100 text-blue-700"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        disabled ? "pointer-events-none opacity-30" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-zinc-200" />;
}

export function RichTextEditor({
  content = "",
  placeholder,
  onChange,
  className,
  onUploadImage,
  onUploadFile,
}: RichTextEditorProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, linkOnPaste: true }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write your announcement here…",
      }),
    ],
    content,
    editorProps: {
      attributes: { class: "focus:outline-none" },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const nextContent = content || "";
    if (editor.getHTML() === nextContent) return;

    editor.commands.setContent(nextContent, { emitUpdate: false });
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkDialogOpen(false);
  }, [editor, linkUrl]);

  const insertImage = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl("");
    setImageDialogOpen(false);
    setUploadError(null);
  }, [editor, imageUrl]);

  const handleImageUpload = useCallback(
    async (file: File | null) => {
      if (!editor || !file || !onUploadImage) return;

      setUploadingImage(true);
      setUploadError(null);

      try {
        const url = await onUploadImage(file);
        if (!url.trim()) {
          throw new Error("Image upload succeeded but no URL was returned.");
        }
        editor.chain().focus().setImage({ src: url }).run();
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Failed to upload image.");
      } finally {
        setUploadingImage(false);
        if (imageUploadInputRef.current) {
          imageUploadInputRef.current.value = "";
        }
      }
    },
    [editor, onUploadImage],
  );

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!editor || !file || !onUploadFile) return;

      setUploadingFile(true);
      setUploadError(null);

      try {
        const uploaded = await onUploadFile(file);
        const href = uploaded.url.trim();
        if (!href) {
          throw new Error("Attachment upload succeeded but no URL was returned.");
        }

        const label = escapeHtml((uploaded.name ?? file.name).trim() || "Download attachment");
        editor
          .chain()
          .focus()
          .insertContent(`<p><a href="${escapeHtml(href)}">${label}</a></p>`)
          .run();
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Failed to upload attachment.");
      } finally {
        setUploadingFile(false);
        if (fileUploadInputRef.current) {
          fileUploadInputRef.current.value = "";
        }
      }
    },
    [editor, onUploadFile],
  );

  if (!editor) return null;

  return (
    <div className={["flex flex-col rounded-lg border border-zinc-200 bg-white", className ?? ""].join(" ").trim()}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-2 py-1.5">
        {/* Undo/Redo */}
        <ToolbarButton
          title="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <ToolbarButton
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Text formatting */}
        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Inline Code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          title="Align Left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Align Center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Align Right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          title="Bullet List"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered List"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Blocks */}
        <ToolbarButton
          title="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Code Block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Horizontal Rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Link & Image */}
        <ToolbarButton
          title="Insert Link"
          active={editor.isActive("link")}
          onClick={() => {
            const existing = editor.getAttributes("link").href as string | undefined;
            setLinkUrl(existing ?? "");
            setLinkDialogOpen(true);
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Insert Image"
          onClick={() => {
            setImageUrl("");
            setImageDialogOpen(true);
          }}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {onUploadImage && (
          <ToolbarButton
            title="Upload Image"
            disabled={uploadingImage}
            onClick={() => imageUploadInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
        {onUploadFile && (
          <ToolbarButton
            title="Upload Attachment"
            disabled={uploadingFile}
            onClick={() => fileUploadInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}

        <Divider />

        <ToolbarButton
          title="Clear Formatting"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <div className="px-5 py-4">
        <EditorContent editor={editor} />
      </div>

      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null)}
      />
      <input
        ref={fileUploadInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={(event) => void handleFileUpload(event.target.files?.[0] ?? null)}
      />

      {(uploadingImage || uploadingFile || uploadError) && (
        <div className="border-t border-zinc-200 px-5 py-2 text-[11px]">
          {uploadingImage && <p className="text-zinc-500">Uploading image…</p>}
          {uploadingFile && <p className="text-zinc-500">Uploading attachment…</p>}
          {uploadError && <p className="text-red-600">{uploadError}</p>}
        </div>
      )}

      {/* Link dialog */}
      {linkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="w-80 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Insert Link</h3>
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setLink()}
              placeholder="https://..."
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkDialogOpen(false);
                  }}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={setLink}
                className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image dialog */}
      {imageDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="w-80 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Insert Image</h3>
            <input
              autoFocus
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && insertImage()}
              placeholder="https://..."
              className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImageDialogOpen(false)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertImage}
                className="rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
