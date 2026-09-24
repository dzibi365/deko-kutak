import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, Youtube as YoutubeIcon,
  Minus, Undo, Redo, Unlink, LayoutGrid, Baseline,
} from "lucide-react";
import { FeatureGridExtension } from "./FeatureGridExtension";

const PRESET_COLORS = [
  { label: "Default",  value: "" },
  { label: "Navy",     value: "#1a1a2e" },
  { label: "Copper",   value: "#c8813a" },
  { label: "Gray",     value: "#6b7280" },
  { label: "Red",      value: "#dc2626" },
  { label: "Green",    value: "#16a34a" },
  { label: "Blue",     value: "#2563eb" },
  { label: "Purple",   value: "#7c3aed" },
  { label: "White",    value: "#ffffff" },
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ColorPicker({ currentColor, onSet, onUnset }: {
  currentColor: string;
  onSet: (color: string) => void;
  onUnset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Text color"
        onClick={() => setOpen((o) => !o)}
        className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-gray-100 transition-colors"
      >
        <Baseline className="w-4 h-4 text-gray-500" />
        <div
          className="w-4 h-1 rounded-full"
          style={{ backgroundColor: currentColor || "#1a1a2e" }}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-10 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 min-w-[140px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-0.5">Text color</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_COLORS.filter(c => c.value).map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => { onSet(c.value); setOpen(false); }}
                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                  currentColor === c.value ? "border-navy" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value, boxShadow: c.value === "#ffffff" ? "inset 0 0 0 1px #e5e7eb" : undefined }}
              />
            ))}
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center gap-2">
            <input
              type="color"
              defaultValue={currentColor || "#1a1a2e"}
              onChange={(e) => onSet(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              title="Custom color"
            />
            <span className="text-[11px] text-gray-400">Custom</span>
            <button
              type="button"
              onClick={() => { onUnset(); setOpen(false); }}
              className="ml-auto text-[11px] text-gray-400 hover:text-navy transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-copper underline" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write product description…" }),
      FeatureGridExtension,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (active: boolean, title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? "bg-navy text-white" : "text-gray-500 hover:text-navy hover:bg-gray-100"}`}
    >
      {children}
    </button>
  );

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `product-descriptions/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { alert("Image upload failed: " + error.message); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
  };

  const addYoutube = () => {
    const url = prompt("YouTube URL:");
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const addLink = () => {
    const url = prompt("URL:", editor.getAttributes("link").href ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const currentColor = editor.getAttributes("textStyle").color ?? "";

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-navy/20 focus-within:border-navy transition">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        {btn(false, "Undo", () => editor.chain().focus().undo().run(), <Undo className="w-4 h-4" />)}
        {btn(false, "Redo", () => editor.chain().focus().redo().run(), <Redo className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("bold"), "Bold", () => editor.chain().focus().toggleBold().run(), <Bold className="w-4 h-4" />)}
        {btn(editor.isActive("italic"), "Italic", () => editor.chain().focus().toggleItalic().run(), <Italic className="w-4 h-4" />)}
        <ColorPicker
          currentColor={currentColor}
          onSet={(color) => editor.chain().focus().setColor(color).run()}
          onUnset={() => editor.chain().focus().unsetColor().run()}
        />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("heading", { level: 1 }), "Heading 1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="w-4 h-4" />)}
        {btn(editor.isActive("heading", { level: 2 }), "Heading 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="w-4 h-4" />)}
        {btn(editor.isActive("heading", { level: 3 }), "Heading 3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("bulletList"), "Bullet list", () => editor.chain().focus().toggleBulletList().run(), <List className="w-4 h-4" />)}
        {btn(editor.isActive("orderedList"), "Numbered list", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("link"), "Add link", addLink, <LinkIcon className="w-4 h-4" />)}
        {editor.isActive("link") && btn(false, "Remove link", () => editor.chain().focus().unsetLink().run(), <Unlink className="w-4 h-4" />)}
        {btn(false, "Horizontal rule", () => editor.chain().focus().setHorizontalRule().run(), <Minus className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          title="Insert image"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded text-gray-500 hover:text-navy hover:bg-gray-100 transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        {btn(false, "Insert YouTube video", addYoutube, <YoutubeIcon className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          title="Insert feature grid"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({ type: "featureGrid", attrs: { features: [{ icon: "Star", title: "", desc: "" }] } })
              .run()
          }
          className="flex items-center gap-1 px-2 py-1.5 rounded text-gray-500 hover:text-copper hover:bg-gray-100 transition-colors text-xs font-medium"
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Features</span>
        </button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none min-h-[160px] px-4 py-3 text-navy focus:outline-none
          [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[140px]
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0
          [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:my-2
          [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h1]:mb-2
          [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1
          [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-1
          [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5
          [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5
          [&_.ProseMirror_li]:my-0.5
          [&_.ProseMirror_hr]:border-navy/20 [&_.ProseMirror_hr]:my-3"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
      />
    </div>
  );
}
